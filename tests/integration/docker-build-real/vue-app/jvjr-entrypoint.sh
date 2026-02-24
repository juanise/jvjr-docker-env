#!/bin/sh
# =============================================================================
# jvjr-entrypoint.sh
#
# PURPOSE
#   Docker container entrypoint for jvjr-docker-env.
#   Substitutes environment variables into compiled frontend JS bundles at
#   container startup, enabling runtime configuration without rebuilding the
#   image (12-factor app pattern).
#
# USAGE  (set in Dockerfile)
#   ENTRYPOINT [ "/jvjr-entrypoint.sh", "<dist_js_dir>", "<js_file_prefix>" ]
#   CMD        [ "nginx", "-g", "daemon off;" ]
#
# POSITIONAL ARGUMENTS
#   $1  dist_js_dir      Absolute path to the compiled JS directory.
#                        Example: /usr/share/nginx/html/js
#   $2  js_file_prefix   Filename prefix of the JS bundles to process.
#                        Example: app  (matches app.<hash>.js)
#   $@  (remaining)      Main process handed off via exec at the end.
#                        Example: nginx -g "daemon off;"
#
# RUNTIME ENVIRONMENT VARIABLES
#   PUBLIC_PATH          Optional. URL base path when serving the app from a
#                        subpath (e.g. /myapp/). Falls back in priority order to
#                        VUE_APP_PUBLIC_PATH, then REACT_APP_PUBLIC_PATH.
#   VUE_APP_* / REACT_APP_*
#                        All variable names listed in jvjr-env.json are read and
#                        substituted into the JS bundle files on startup.
#
# EXECUTION FLOW
#   0. Restore /usr/share/nginx/html from the immutable /app-source/ copy
#      so every startup begins from a clean, unmodified state (idempotent).
#   1. Parse $1 to derive the nginx html root (base_dir) and the JS subpath.
#   2. Consume $2 as the JS bundle filename prefix.
#   3. Resolve PUBLIC_PATH from environment (or detect it from index.html).
#   4. Read jvjr-env.json to build the list of env var names to substitute.
#   5. Detect the default public path baked into the build via index.html.
#   6. If PUBLIC_PATH differs from the built-in default: rewrite src/href
#      references in index.html and relocate assets to the correct subdirectory.
#   7. For each matching JS bundle, substitute each env var using envsubst.
#   8. Hand off to the main process via exec (replaces this shell process).
# =============================================================================


# =============================================================================
# SECTION 1 — ARGUMENT PARSING
#
# Derives three values from $1:
#   dist_js_dir  — the full JS directory path  (kept as-is from $1)
#   base_dir     — the nginx html root          (e.g. /usr/share/nginx/html)
#   end_path     — the subpath after html/      (e.g. js)
# =============================================================================

# Consume $1 immediately so $@ contains only the exec command for later.
dist_js_dir="$1"; shift

# Derive base_dir: strip "html/<subpath>" from the end, then re-append "html".
#
#   Example: /usr/share/nginx/html/js
#     %html\/*  →  /usr/share/nginx/           (strips "html/js")
#     ##*/html  →  non-empty (no "html" in "/usr/share/nginx/")
#               →  append "html"
#     result    →  /usr/share/nginx/html
base_dir="${dist_js_dir%html\/*}"
if [ ! -z ${base_dir##*/html} ]; then
    base_dir="${base_dir}html"
fi

# Derive end_path: the portion of dist_js_dir that follows "html/".
# If "html/" is not present, end_path is empty.
#   Example: /usr/share/nginx/html/js  →  end_path = js
end_path="${dist_js_dir#*html\/}"
if [ "$end_path" = "$dist_js_dir" ]; then
    end_path=""
fi

# Guard: base_dir + end_path must reconstruct dist_js_dir exactly.
# Multiple "html" segments in the path would break the parsing above.
if [[ "$dist_js_dir" != "$(echo "$base_dir/$end_path" | sed 's/\/$//g')" ]]; then
    echo "Error, more than one 'html' dir on path"
fi

echo "'\$dist_js_dir'    $dist_js_dir"

# Consume $2: the filename prefix used to find JS bundle files.
# Example: "app" matches app.<contenthash>.js produced by Vite or Webpack.
js_file_prefix="$1"; shift

echo "'\$js_file_prefix' $js_file_prefix"

# Resolve the absolute directory where this script lives.
# Used to locate jvjr-env.json, which is deployed alongside it.
SCRIPTPATH="$( cd "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"


# =============================================================================
# SECTION 2 — PUBLIC PATH CONFIGURATION
#
# PUBLIC_PATH controls the URL subpath from which the app is served.
# If not set here, it is auto-detected from index.html in Section 5.
# Priority: PUBLIC_PATH > VUE_APP_PUBLIC_PATH > REACT_APP_PUBLIC_PATH
# =============================================================================

PUBLIC_PATH=${PUBLIC_PATH:-${VUE_APP_PUBLIC_PATH:-$REACT_APP_PUBLIC_PATH}}


# =============================================================================
# SECTION 3 — VARIABLE LIST EXTRACTION
#
# Reads jvjr-env.json and extracts only the env var names (right-hand values).
#
# jvjr-env.json format:
#   {
#     "API_URL":   "$VUE_APP_API_URL",
#     "APP_TITLE": "$VUE_APP_TITLE"
#   }
#
# Resulting $vars (one name per line, $ prefix removed):
#   VUE_APP_API_URL
#   VUE_APP_TITLE
#
# Pipeline:
#   cat          — read the JSON file
#   sed (strip)  — remove JSON punctuation: { } ' , " $
#   sed (filter) — discard blank / whitespace-only lines
#   cut -f2      — take only the right side of each "KEY : VALUE" pair
#   sed (trim)   — strip leading and trailing whitespace from each name
# =============================================================================

vars=$(
    cat "$SCRIPTPATH/jvjr-env.json" \
        | sed "s/{//g; s/}//g; s/'//g; s/,//g; s/\"//g; s/\\$//g" \
        | sed -rn '/\S/p' \
        | cut -d':' -f2 \
        | sed -e 's/^[[:space:]]*//; s/[[:space:]]*$//'
)

printf "VARIABLES:\n%s\n" "$vars"


# =============================================================================
# SECTION 4 — FUNCTION: getDefaultPath
#
# Reads index.html to detect the public base path that was baked in at build
# time by the bundler (Vite, Webpack, etc.).
#
# Sets global variables:
#   DEFAULT_PATH — the URL root path of the built assets   (e.g. / or /myapp/)
#   QUOTE        — set to "yes" if src attributes use double quotes
#
# NOTE: This function must be called WITHOUT output capture (i.e. as a plain
# call, not via DEFAULT_PATH=$(getDefaultPath)). Capturing the output would
# run the function in a subshell and the global variables DEFAULT_PATH and
# QUOTE would be lost. The final echo is a log line, not a return value.
#
# Examples:
#   <script src="/js/app.abc.js">    →  DEFAULT_PATH = /
#   <script src=/myapp/js/app.abc.js> →  DEFAULT_PATH = /myapp/
# =============================================================================

getDefaultPath() {
    indexFile=$(cat "$base_dir/index.html")

    # Find the <script src="..."> attribute referencing a bundle with the prefix.
    # Splitting on spaces puts each HTML attribute on its own line for sed to match.
    DEFAULT_PATH=$(
        echo "$indexFile" \
            | tr " " "\n" \
            | sed -n -E "/(src=\"?\/.*\/*$js_file_prefix*)/p" \
            | cut -d'>' -f1
    )

    # Detect whether src uses quoted (src="...") or unquoted (src=...) syntax.
    # Strip the quotes and flag the style — the same style must be used later
    # when rewriting src/href in modifyPublicPath.
    if test "${DEFAULT_PATH#*\"}" != "${DEFAULT_PATH}"; then
        DEFAULT_PATH=$(echo "$DEFAULT_PATH" | sed 's/"//g')
        QUOTE="yes"
    fi

    # Strip the "src=" prefix, resolve the containing directory, then remove
    # the end_path suffix to obtain the URL root path.
    #   Example: src=/js/app.main.js  →  dirname → /js  →  strip "js"  →  /
    DEFAULT_PATH="$(dirname "${DEFAULT_PATH#src=}")"
    DEFAULT_PATH="${DEFAULT_PATH%$end_path}"

    echo "$DEFAULT_PATH"
}


# =============================================================================
# SECTION 5 — FUNCTION: modifyPublicPath
#
# Applies PUBLIC_PATH to the deployed assets:
#   - If PUBLIC_PATH is unset: uses DEFAULT_PATH unchanged (no-op).
#   - If PUBLIC_PATH differs from DEFAULT_PATH:
#       a) Rewrites all href and src references in index.html.
#       b) Physically moves the html assets into the subdirectory that matches
#          PUBLIC_PATH so nginx serves them at the correct URL.
#
# This allows the same Docker image to be deployed at different URL subpaths
# by setting the PUBLIC_PATH environment variable at runtime.
# =============================================================================

modifyPublicPath() {
    if [[ -z "$PUBLIC_PATH" ]]; then
        # No override provided: use the base path that was built into the bundle.
        PUBLIC_PATH="$DEFAULT_PATH"
        echo "Public path not set, using build default: $PUBLIC_PATH"
    else
        # Normalize PUBLIC_PATH: ensure it starts and ends with a slash.
        if [[ "${PUBLIC_PATH: -1}" != '/' ]]; then
            PUBLIC_PATH="${PUBLIC_PATH}/"
        fi
        if [[ "${PUBLIC_PATH::1}" != '/' ]]; then
            PUBLIC_PATH="/${PUBLIC_PATH}"
        fi
    fi

    echo "Resolved public path: $PUBLIC_PATH"

    # If PUBLIC_PATH differs from the build-time default, rewrite the asset
    # references in index.html so the browser loads from the correct subpath.
    if [[ "$PUBLIC_PATH" != "$DEFAULT_PATH" ]]; then
        if [[ "$QUOTE" == "yes" ]]; then
            # src and href attributes use double-quoted values.
            sed -i \
                -e "s|href=\"$DEFAULT_PATH|href=\"$PUBLIC_PATH|g" \
                -e "s|src=\"$DEFAULT_PATH|src=\"$PUBLIC_PATH|g" \
                "$base_dir/index.html"
        else
            # src and href attributes use unquoted values.
            sed -i \
                -e "s|href=$DEFAULT_PATH|href=$PUBLIC_PATH|g" \
                -e "s|src=$DEFAULT_PATH|src=$PUBLIC_PATH|g" \
                "$base_dir/index.html"
        fi
    fi

    # If PUBLIC_PATH is a non-root subpath, restructure the asset directory so
    # nginx can serve files at the correct URL path.
    #   Example: PUBLIC_PATH=/myapp/  →  move html/* into html/myapp/
    if [[ "$PUBLIC_PATH" != '/' ]] && [[ "${PUBLIC_PATH::1}" == '/' ]]; then
        echo "Creating public path directory: $PUBLIC_PATH"
        mkdir -p "/tmp/jvjr$PUBLIC_PATH"
        mv "$base_dir"/* "/tmp/jvjr$PUBLIC_PATH"
        mv "/tmp/jvjr$PUBLIC_PATH" "$base_dir"

        # Update dist_js_dir to point to the JS bundles in the new location.
        dist_js_dir="$base_dir${PUBLIC_PATH}${end_path}"
    fi
}


# =============================================================================
# MAIN EXECUTION
# =============================================================================

# Step 0 — Restore the nginx serving directory from the immutable source copy.
#
#          /app-source/ is baked into the image at build time and is NEVER
#          modified at runtime. Restoring from it here guarantees:
#            - Idempotency: multiple container starts always start from a
#              clean, unmodified copy of the original build artifacts.
#            - Restart safety: if PUBLIC_PATH changed between runs, the
#              previously relocated/patched files are discarded and the
#              original structure is restored before any processing begins.
#            - Crash recovery: a mid-run failure leaves no partial state.
#
#          Without this step, modifyPublicPath's mv + sed -i mutations would
#          persist across container restarts (Docker writable layer), causing
#          the entrypoint to fail on the second start because index.html and
#          the JS directory are no longer at the paths ENTRYPOINT expects.
rm -rf /usr/share/nginx/html/*
cp -r /app-source/. /usr/share/nginx/html/
echo "Serving directory restored from /app-source"

# Step 1 — Detect the public base path baked into the compiled bundle.
#          Sets global DEFAULT_PATH (and QUOTE). Called without $() capture
#          to keep the global variable mutations visible to modifyPublicPath.
getDefaultPath

# Step 2 — Apply PUBLIC_PATH override, or confirm the build-time default.
modifyPublicPath

# Step 3 — Substitute environment variables into each JS bundle file.
#
# For each file matching <dist_js_dir>/<prefix>.<hash>.js:
#
#   a) TEMPLATE BACKUP: a .tmpl.js copy is created at the start of each file's
#      processing loop so sequential envsubst passes always read the previous
#      output, not the partially-substituted result of a concurrent step.
#
#   b) SEQUENTIAL SUBSTITUTION: each env var is passed to envsubst individually.
#      Specifying one variable at a time (envsubst '$VAR_NAME') prevents envsubst
#      from erasing other $PLACEHOLDER patterns not yet ready for substitution.
#      Each pass writes its output and that output becomes the input for the next.
#
#   c) SKIP IF UNSET: if an env var has no value in the container environment,
#      its $PLACEHOLDER is left untouched in the JS file.
#
#   d) CLEANUP: the .tmpl.js backup is removed once all vars are processed.
#
# NOTE: the glob ($dist_js_dir/$js_file_prefix.*.js) is intentionally unquoted
# so the shell expands the wildcard * against the filesystem.
for file in $dist_js_dir/$js_file_prefix.*.js; do

    # Create a one-time template backup (skip if already exists from a prior run).
    if [ ! -f "$file.tmpl.js" ]; then
        cp "$file" "$file.tmpl.js"
    fi

    # Iterate over each env var name extracted from jvjr-env.json.
    printf %s "$vars" | while IFS= read -r line || [ -n "$line" ]; do

        # Resolve the runtime value of this env var from the container environment.
        # eval expands $line as a variable name: if line=VUE_APP_API_URL,
        # this evaluates to: content=$VUE_APP_API_URL
        eval content=\$$line
        echo "CONTENT: $line : $content"

        # Substitute only if the env var is non-empty.
        # Unset vars are skipped: their $PLACEHOLDER remains in the JS file.
        if [ ! "$content" = '' ]; then
            envsubst '$'"$line" < "$file.tmpl.js" > "$file"
            cp "$file" "$file.tmpl.js"
        fi
    done

    # Remove the template backup once all substitutions are complete.
    if [ -f "$file.tmpl.js" ]; then
        rm "$file.tmpl.js"
    fi
done

# Step 4 — Hand off to the main container process (nginx).
#          exec replaces this shell process entirely, so nginx becomes PID 1.
echo "Starting"
exec "$@"
