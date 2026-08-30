import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { applyChatFont } from "./chatFont";
import { applyTheme } from "./theme";
import "./styles/retrieva.css";

// Apply the saved theme and chat font before first paint.
applyTheme();
applyChatFont();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
