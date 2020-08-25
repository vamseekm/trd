import * as React from "react";
import { Box, AppBar, Toolbar } from "@material-ui/core";
export class App extends React.Component {
  render() {
    return (
      <Box height="100vh" display="flex" flexDirection="column">
        <AppBar position="static">
          <Toolbar variant="dense"></Toolbar>
        </AppBar>
        <Box flexGrow="1">
          <h1>Hello World</h1>
        </Box>
      </Box>
    );
  }
}
