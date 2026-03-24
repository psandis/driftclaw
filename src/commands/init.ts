import { render } from "ink";
import React from "react";
import { InitWizard } from "../components/InitWizard.js";

export async function runInit() {
  const { waitUntilExit } = render(React.createElement(InitWizard));
  await waitUntilExit();
}
