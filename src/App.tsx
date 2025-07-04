import { ThemeProvider, createTheme } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { WebFlasherPage } from "./pages/WebFlasherPage";
import { FirmwareInstallPage } from "./pages/FirmwareInstallPage";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
    background: {
      default: "#121212",
      paper: "#1e1e1e",
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route
            path="/"
            element={<WebFlasherPage />}
          />
          <Route
            path="/install"
            element={<FirmwareInstallPage />}
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
