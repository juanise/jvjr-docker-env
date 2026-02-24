import React from 'react';

function App() {
  const apiUrl = process.env.REACT_APP_API_URL || 'http://default';
  const title = process.env.REACT_APP_TITLE || 'Default';

  return (
    <div>
      <h1>{title}</h1>
      <p>API: {apiUrl}</p>
    </div>
  );
}

export default App;
