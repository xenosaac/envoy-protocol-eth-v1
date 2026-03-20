#!/usr/bin/env node
import { Command } from "commander";
import { initProject } from "./init.js";
import { runDemo } from "./demo.js";

const program = new Command();

program
  .name("on-chain-agent")
  .description("CLI tool for the On-Chain Agent SDK")
  .version("0.1.0");

program
  .command("init <name>")
  .description("Scaffold a new on-chain agent project")
  .action(async (name: string) => {
    await initProject(name);
  });

program
  .command("demo")
  .description("Print instructions for running a local lifecycle demo")
  .action(() => {
    runDemo();
  });

program.parse(process.argv);
