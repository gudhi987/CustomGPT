import { createRoot } from "react-dom/client";
import "./styles/global_styles.css";
import Sidebar from "./components/sidebar.jsx";
import ChatbotInteraction from "./components/interaction.jsx";
import TargetConfiguration from "./components/configuration.jsx";

const rootElement = document.getElementById('root');

createRoot(rootElement).render(
    <>
        <div style={{display: "flex"}}>
            <Sidebar />
            <ChatbotInteraction />
        </div>
    </>
);