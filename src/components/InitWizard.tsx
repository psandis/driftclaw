import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Box, Text, useApp, useInput } from "ink";
import React, { useState } from "react";
import { stringify } from "yaml";

type Step = "environments" | "services" | "confirm" | "done";

interface EnvEntry {
  name: string;
  url: string;
}

interface ServiceEntry {
  name: string;
  source: "http" | "git-tag";
  path?: string;
  field?: string;
  repo?: string;
}

export function InitWizard() {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>("environments");
  const [input, setInput] = useState("");
  const [envs, setEnvs] = useState<EnvEntry[]>([]);
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [subStep, setSubStep] = useState<"name" | "url" | "source" | "path" | "field" | "repo">(
    "name",
  );
  const [currentName, setCurrentName] = useState("");
  const [currentSource, setCurrentSource] = useState<"http" | "git-tag">("http");

  useInput((value, key) => {
    if (key.return) {
      handleSubmit();
      return;
    }
    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }
    if (value && !key.ctrl && !key.meta) {
      setInput((prev) => prev + value);
    }
  });

  function handleSubmit() {
    const trimmed = input.trim();

    if (step === "environments") {
      if (subStep === "name") {
        if (!trimmed) {
          if (envs.length > 0) {
            setStep("services");
            setSubStep("name");
            setInput("");
            return;
          }
          return;
        }
        setCurrentName(trimmed);
        setSubStep("url");
        setInput("");
      } else if (subStep === "url") {
        if (!trimmed) return;
        setEnvs((prev) => [...prev, { name: currentName, url: trimmed }]);
        setSubStep("name");
        setInput("");
      }
    } else if (step === "services") {
      if (subStep === "name") {
        if (!trimmed) {
          if (services.length > 0) {
            setStep("confirm");
            setInput("");
            return;
          }
          return;
        }
        setCurrentName(trimmed);
        setSubStep("source");
        setInput("");
      } else if (subStep === "source") {
        const source = trimmed === "2" ? "git-tag" : "http";
        setCurrentSource(source);
        if (source === "http") {
          setSubStep("path");
        } else {
          setSubStep("repo");
        }
        setInput("");
      } else if (subStep === "path") {
        const path = trimmed || "/version";
        setSubStep("field");
        setInput("");
        // Store path temporarily via closure
        const svcPath = path;
        // We need field next, store path in a ref-like way
        setServices((prev) => [
          ...prev,
          { name: currentName, source: "http", path: svcPath, field: "version" },
        ]);
        setSubStep("name");
        setInput("");
      } else if (subStep === "repo") {
        if (!trimmed) return;
        setServices((prev) => [...prev, { name: currentName, source: "git-tag", repo: trimmed }]);
        setSubStep("name");
        setInput("");
      }
    } else if (step === "confirm") {
      writeConfig();
      setStep("done");
      setTimeout(() => exit(), 100);
    }
  }

  function writeConfig() {
    const config: Record<string, unknown> = {
      environments: Object.fromEntries(envs.map((e) => [e.name, { url: e.url }])),
      services: Object.fromEntries(
        services.map((s) => {
          const entry: Record<string, string> = { source: s.source };
          if (s.path) entry.path = s.path;
          if (s.field) entry.field = s.field;
          if (s.repo) entry.repo = s.repo;
          return [s.name, entry];
        }),
      ),
    };

    const yaml = stringify(config);
    writeFileSync(resolve("driftclaw.yaml"), yaml);
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      {step === "environments" && (
        <>
          <Text bold>Configure environments</Text>
          {envs.map((e) => (
            <Text key={e.name} dimColor>
              {" "}
              {e.name}: {e.url}
            </Text>
          ))}
          {subStep === "name" && (
            <Text>
              Environment name (empty to finish): <Text color="cyan">{input}</Text>
            </Text>
          )}
          {subStep === "url" && (
            <Text>
              URL for {currentName}: <Text color="cyan">{input}</Text>
            </Text>
          )}
        </>
      )}

      {step === "services" && (
        <>
          <Text bold>Configure services</Text>
          {services.map((s) => (
            <Text key={s.name} dimColor>
              {" "}
              {s.name}: {s.source}
            </Text>
          ))}
          {subStep === "name" && (
            <Text>
              Service name (empty to finish): <Text color="cyan">{input}</Text>
            </Text>
          )}
          {subStep === "source" && (
            <Text>
              Source for {currentName} (1=http, 2=git-tag): <Text color="cyan">{input}</Text>
            </Text>
          )}
          {subStep === "path" && (
            <Text>
              HTTP path [{"/version"}]: <Text color="cyan">{input}</Text>
            </Text>
          )}
          {subStep === "repo" && (
            <Text>
              GitHub repo (owner/name): <Text color="cyan">{input}</Text>
            </Text>
          )}
        </>
      )}

      {step === "confirm" && (
        <>
          <Text bold>Config summary:</Text>
          <Text>
            {" "}
            {envs.length} environments, {services.length} services
          </Text>
          <Text>Press Enter to write driftclaw.yaml</Text>
        </>
      )}

      {step === "done" && <Text color="green">Created driftclaw.yaml</Text>}
    </Box>
  );
}
