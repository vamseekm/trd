import * as React from "react";
import {
  Button,
  ThemeProvider,
  CssBaseline,
  AppBar,
  Toolbar,
  IconButton,
} from "@material-ui/core";
import { theme } from "../theme";
import { App } from "./App";

export interface HelloProps {
  compiler: string;
  framework: string;
}
// 'HelloProps' describes the shape of props.
// State is never set so we use the '{}' type.
export class Base extends React.Component<HelloProps, {}> {
  render() {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App></App>
      </ThemeProvider>
    );
  }
}
