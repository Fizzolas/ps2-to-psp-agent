import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';
import os from 'os';

const REPORT_PATH = path.join(os.homedir(), 'Desktop', 'ps2-to-psp-agent-report.txt');

async function main() {
  try {
    const [,, ps2Folder, apiKey] = process.argv;
    if (!ps2Folder || !apiKey) {
      console.error('Usage: node src/index.js <PS2_GAME_FOLDER> <PERPLEXITY_API_KEY>');
      process.exit(1);
    }

    await fs.ensureDir(ps2Folder);
    if (!(await fs.pathExists(ps2Folder))) {
      throw new Error(`PS2 folder does not exist: ${ps2Folder}`);
    }

    const state = {
      ps2Folder: path.resolve(ps2Folder),
      workDir: path.resolve('work'),
      logsDir: path.resolve('logs'),
      targetDir: path.resolve('output_psp'),
      tasks: [],
      errors: []
    };

    await fs.ensureDir(state.workDir);
    await fs.ensureDir(state.logsDir);
    await fs.ensureDir(state.targetDir);

    // Initial analysis
    const analysis = await analyzeGameFolder(state);

    // Agent loop
    let iteration = 0;
    while (iteration < 20) {
      iteration++;
      const plan = await callPerplexity(apiKey, buildPrompt(state, analysis, iteration));
      const result = await executePlanStep(state, plan);
      if (result.done) break;
    }

    await writeReport(state, 'Completed agent loop. Check output_psp for results.');
    console.log('Done.');
  } catch (err) {
    await fs.outputFile(REPORT_PATH, `Fatal error:\n${err.stack || err.message}`);
    console.error('Fatal error. Report written to:', REPORT_PATH);
    process.exit(1);
  }
}

async function analyzeGameFolder(state) {
  const files = await fs.readdir(state.ps2Folder);
  return { files };
}

function buildPrompt(state, analysis, iteration) {
  return `You are an autonomous game porting agent.
Target: Take a PS2 game folder and iteratively create a PSP-compatible game folder.

Constraints:
- You can only respond with JSON specifying actions.
- Do not output explanations.

Iteration: ${iteration}

PS2 folder: ${state.ps2Folder}
Work dir: ${state.workDir}
Target dir: ${state.targetDir}

Detected files: ${JSON.stringify(analysis.files).slice(0, 4000)}

Allowed actions:
- "generate_script": create a script file (C/C++/Python/etc.) in workDir.
- "run_command": run a shell command (e.g., external converters, compilers).
- "plan_note": add notes for next iterations.

Respond JSON:
{
  "actions": [
    {
      "type": "generate_script" | "run_command" | "plan_note",
      "description": "short text",
      "path": "relative/path/if_applicable",
      "language_or_shell": "python" | "bash" | "cpp" | null,
      "content_or_command": "script body or shell command"
    }
  ],
  "done": false
}`;
}

async function callPerplexity(apiKey, prompt) {
  const res = await axios.post('https://api.perplexity.ai/chat/completions', {
    model: 'sonar-pro',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  const content = res.data.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch (e) {
    return { actions: [{ type: 'plan_note', description: 'Failed to parse JSON from model.', content_or_command: content }], done: false };
  }
}

async function executePlanStep(state, plan) {
  if (!plan || !Array.isArray(plan.actions)) return { done: true };

  for (const action of plan.actions) {
    try {
      if (action.type === 'generate_script') {
        const outPath = path.join(state.workDir, action.path || 'script_generated.txt');
        await fs.outputFile(outPath, action.content_or_command || '');
      } else if (action.type === 'run_command') {
        await runCommand(action.content_or_command, state.logsDir);
      } else if (action.type === 'plan_note') {
        // Just log for now
        await fs.appendFile(path.join(state.logsDir, 'plan_notes.log'), `\n${new Date().toISOString()} - ${action.description}`);
      }
    } catch (err) {
      state.errors.push({ action, error: err.message });
    }
  }

  return { done: !!plan.done };
}

function runCommand(cmd, logsDir) {
  return new Promise((resolve) => {
    const logFile = path.join(logsDir, `cmd_${Date.now()}.log`);
    const child = spawn(cmd, { shell: true });
    const logStream = fs.createWriteStream(logFile);
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);
    child.on('close', () => resolve());
  });
}

async function writeReport(state, summary) {
  const report = `Summary: ${summary}\nErrors: ${JSON.stringify(state.errors, null, 2)}`;
  await fs.outputFile(REPORT_PATH, report);
}

main();
