import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";

const root = document.getElementById("root");
if (!root) throw new Error("画面の描画先が見つかりません。");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
