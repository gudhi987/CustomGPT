import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles/global_styles.css";
import Sidebar from "./components/sidebar.jsx";
import ChatbotInteraction from "./components/interaction.jsx";

const rootElement = document.getElementById('root');

createRoot(rootElement).render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={
                <div style={{display: "flex"}}>
                    <Sidebar />
                    <ChatbotInteraction />
                </div>
            } />
            <Route path="/chat/:chatId" element={
                <div style={{display: "flex"}}>
                    <Sidebar />
                    <ChatbotInteraction />
                </div>
            } />
        </Routes>
    </BrowserRouter>
);

export default createRoot;