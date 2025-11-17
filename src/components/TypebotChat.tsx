import { useEffect } from 'react';

export const TypebotChat = () => {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'module';
    script.innerHTML = `
      import Typebot from 'https://cdn.jsdelivr.net/npm/@typebot.io/js@0.3/dist/web.js'
      
      Typebot.initBubble({
        typebot: "lead-generation-5cat1f5",
        apiHost: "https://typebot.io",
        theme: {
          button: { backgroundColor: "#0EA5E9" }
        }
      });
    `;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
};
