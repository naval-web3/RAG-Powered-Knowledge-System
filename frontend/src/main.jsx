import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { applyChatFont } from "./chatFont";
import { applyLocale, LocaleProvider } from "./i18n";
import { applyTheme } from "./theme";
import "./styles/retrieva.css";

// Apply the saved theme and chat font before first paint.
applyTheme();
applyChatFont();
applyLocale();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  </React.StrictMode>
);
