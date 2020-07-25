import * as React from "react";

export interface HelloProps {
  compiler: string;
  framework: string;
}

// 'HelloProps' describes the shape of props.
// State is never set so we use the '{}' type.
export class Hello extends React.Component<HelloProps, {}> {
  render() {
    return (
      <h1>
        hello hi Ha, Hello 1234567891011 from {this.props.compiler} and{" "}
        {this.props.framework}! ha ha ha
      </h1>
    );
  }
}
