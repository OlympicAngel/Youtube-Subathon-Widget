window.customPrompt = function (message, defaultValue = "") {
    return new Promise((resolve) => {
        // Backdrop
        const overlay = document.createElement("div");
        overlay.style = `
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      font-family: sans-serif;
      font-size: 2rem;
    `;

        // Dialog box
        const box = document.createElement("div");
        box.style = `
      background: #f0f0f0;
      padding: 20px 30px;
      border: 1px solid #ccc;
      border-radius: 5px;
      min-width: 300px;
      box-shadow: 0 0 2em rgba(0,0,0,0.9);
      color: black;
    `;

        // Message
        const text = document.createElement("div");
        text.textContent = message;
        text.style = `margin-bottom: 10px;`;

        // Input field
        const input = document.createElement("input");
        input.type = "text";
        input.value = defaultValue;
        input.style = `
      width: 100%;
      padding: 5px;
      margin-bottom: 10px;
      border: 1px solid #ccc;
      border-radius: 3px;
      font-size: 1em;
      direction: ltr;
      text-align: center;
    `;

        // Buttons container
        const btns = document.createElement("div");
        btns.style = `display: flex; justify-content: space-between;`;

        const okBtn = document.createElement("button");
        okBtn.textContent = "אישור";
        okBtn.style = `filter: hue-rotate(-255deg) saturate(2.5);`;

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "ביטול";
        cancelBtn.style = ``;

        okBtn.onclick = () => {
            document.body.removeChild(overlay);
            resolve(input.value);
        };

        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
            resolve(null);
        };

        input.onkeydown = (e) => {
            if (e.key === "Enter") okBtn.click();
            if (e.key === "Escape") cancelBtn.click();
        };

        box.appendChild(text);
        box.appendChild(input);
        btns.appendChild(okBtn);
        btns.appendChild(cancelBtn);
        box.appendChild(btns);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        input.focus();
        input.select();
    });
};
