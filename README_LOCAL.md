# How to Run Cost Tracker Locally

This application is configured to run on your local Windows PC without needing XAMPP or complex database setup. It uses a cloud database (Firebase), so you just need an internet connection.

## Prerequisites

- **Node.js**: You need to have Node.js installed. If you don't have it, download and install the "LTS" version from [nodejs.org](https://nodejs.org/).

## How to Run

1.  Double-click the **`start_app.bat`** file in this folder.
2.  A terminal window will open and prepare the application.
    -   *First time only*: It will download necessary files (takes a few minutes).
    -   *First time only*: It will build the app (takes a minute).
3.  Once ready, your default web browser will automatically open to `http://localhost:5000`.

## Troubleshooting

-   **"Node.js is not installed"**: Install Node.js as mentioned above.
-   **Updates**: If you change any code and want to apply it, simply delete the `dist` folder and run `start_app.bat` again to rebuild.
