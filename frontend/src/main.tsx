import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";
import App from "./App.tsx";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
if (!googleClientId) {
  console.warn(
    "VITE_GOOGLE_CLIENT_ID is not set. Google sign-in will not work until you add it to frontend/.env and restart the dev server.",
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId ?? ""}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
);
