import { createMuiTheme } from "@material-ui/core";
import { grey, amber } from "@material-ui/core/colors";

export const theme = createMuiTheme({
  palette: {
    type: "dark",
    primary: {
      main: amber[900],
    },
    background: {
      default: grey[900],
    },
  },
  overrides: {
    MuiButton: {
      root: {
        padding: "2px 4px",
      },
    },
  },
  spacing: 1,
  typography: { fontSize: 12 },
});
