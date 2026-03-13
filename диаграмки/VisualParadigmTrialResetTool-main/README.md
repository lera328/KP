# VisualParadigmTrialResetTool
A simple Python script to reset the trial license of **Visual Paradigm**

---

## 📋 Description

This tool **removes the Visual Paradigm license folder** to reset the trial period.  
It is lightweight, easy to use, and requires only Python installed.

---

## ⚙️ Features

- reset the Visual Paradigm license data safely.
- Asks for user confirmation before proceeding.
- Works on any Windows machine.

---

## ⚠️ Important

> **Make sure you have backed up your projects in Visual Paradigm before resetting the trial.**

Resetting the trial will **remove license-related data**, but **may affect unsaved projects**.  
Please **close Visual Paradigm** before running the tool.

---

## 🛠️ How to Use

### 1. Requirements

- Python installed (Download: [https://www.python.org/downloads/](https://www.python.org/downloads/))
- Python must be added to your system `PATH`.

### 2. Running the Tool

You have two options to run:

#### Option 1: Run with Python manually

Open a terminal (Command Prompt) in the project directory and run:

```bash
python vpreset.py
```

#### Option 2: Run using the `.bat` file (Recommended)

1. Double-click on `VPReset.bat`.
2. A command window will open and run the Python script automatically.
3. Follow the on-screen instructions to reset your Visual Paradigm trial license.
4. When finished, the window will pause so you can review the result.

**Advantages of using `.bat` file:**
- No need to manually open a terminal.
- Easier and faster for non-technical users.
- Helps automate the reset process.

---

### 3. Troubleshooting

- **Python is not recognized as an internal or external command?**
  - Make sure Python is installed and added to your system `PATH`.
  - You can check by opening Command Prompt and typing:

    ```bash
    python --version
    ```

- **Visual Paradigm folder not found?**
  - Make sure Visual Paradigm was installed and launched at least once before running this tool.
  - Or ensure you are using the correct Windows user profile.

- **Permission denied when deleting folder?**
  - Try running the `.bat` file as Administrator.
  - Right-click `VPReset.bat` → **Run as administrator**.

---

## 📦 (Optional) Build into a Standalone `.exe`

If you don't want users to install Python, you can package the script into a `.exe` file.

### Steps to build:

1. Install `pyinstaller`:

    ```bash
    pip install pyinstaller
    ```

2. Build the `.exe` file:

    ```bash
    pyinstaller --onefile vpreset.py
    ```

3. After building, your `.exe` will be located inside the `dist` folder.

4. You can now run the `.exe` directly without needing Python!

---

## 🧑‍💻 Author

- **Matapv01**

---

## 📜 Disclaimer

This tool is intended for educational purposes only.  
Use it responsibly and ensure compliance with Visual Paradigm's licensing terms.

---

