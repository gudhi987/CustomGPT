import "../styles/interaction.css";

function ChatbotInteraction() {
    return (
        <div className="chat-interface">
            <header>
                <p>CustomGPT</p>
            </header>
            <section className="chat-messages">
            </section>
            <footer>
                <textarea></textarea>
            </footer>
        </div>
    );
}

export default ChatbotInteraction;