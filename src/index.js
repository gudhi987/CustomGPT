import ReactDOM from "react-dom/client";
import "./styles/global_styles.css";
import Sidebar from "./components/sidebar";
import ChatbotInteraction from "./components/interaction";
import TargetConfiguration from "./components/configuration";

const rootElement = document.getElementById('root');

ReactDOM.createRoot(rootElement).render(
    // <>
    //     <div style={{display: "flex"}}>
    //         <Sidebar />
    //         <ChatbotInteraction />
    //     </div>
    // </>
    <TargetConfiguration />
);
