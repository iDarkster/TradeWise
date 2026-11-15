import readline from "node:readline/promises";
import { Writable } from "node:stream";

/**
 * Terminal prompts for the administrator bootstrap command.
 *
 * The secret prompt suppresses the readline output, so readline's own echo
 * is discarded and the password never appears on screen.
 *
 * When the input is not a terminal (a pipe or a file) readline runs in
 * non-terminal mode and every line is queued as it arrives, so scripted use
 * stays predictable and no line is lost.
 */

export interface PromptStreams {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
}

/** The promise flavour of `readline.Interface` exposes `output` at runtime. */
interface ReadlineWithOutput extends readline.Interface {
  output: NodeJS.WritableStream;
}

function isTerminal(input: NodeJS.ReadableStream): boolean {
  return Boolean((input as NodeJS.ReadStream & { isTTY?: boolean }).isTTY);
}

function discardingOutput(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

/** Creates a readline interface whose echoed output is discarded. */
export function createHiddenInterface(streams: PromptStreams): readline.Interface {
  return readline.createInterface({
    input: streams.input,
    output: discardingOutput(),
    terminal: isTerminal(streams.input),
  });
}

/**
 * Reads a secret without echoing it.
 *
 * The question is written to the real output; the typed characters are
 * echoed by readline into a discarded stream.
 */
export async function promptHidden(
  question: string,
  streams: PromptStreams,
): Promise<string> {
  streams.output.write(question);

  const rl = createHiddenInterface(streams);

  try {
    return await rl.question("");
  } finally {
    rl.close();
    streams.output.write("\n");
  }
}

/** Reads a visible line of text. */
export async function promptText(
  question: string,
  streams: PromptStreams,
): Promise<string> {
  const rl = readline.createInterface({
    input: streams.input,
    output: streams.output,
    terminal: isTerminal(streams.input),
  });

  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

/**
 * A sequence of prompts sharing one readline interface.
 *
 * Keeping a single interface means buffered input is consumed in order and
 * the terminal is not reconfigured for every question.
 */
export class TerminalPrompter {
  private readonly rl: readline.Interface;
  private readonly terminal: boolean;
  private readonly queuedLines: string[] = [];
  private readonly waitingLines: Array<(line: string) => void> = [];

  constructor(private readonly streams: PromptStreams) {
    this.terminal = isTerminal(streams.input);

    this.rl = readline.createInterface({
      input: streams.input,
      output: streams.output,
      terminal: this.terminal,
    });

    if (!this.terminal) {
      // Queue every line as it arrives so no input is dropped between
      // questions.
      this.rl.on("line", (line: string) => {
        const resolve = this.waitingLines.shift();

        if (resolve) {
          resolve(line);
          return;
        }

        this.queuedLines.push(line);
      });
    }
  }

  /** Reads a visible line of text. */
  async ask(question: string): Promise<string> {
    if (!this.terminal) {
      this.streams.output.write(question);
      return this.readLine();
    }

    return this.rl.question(question);
  }

  /**
   * Reads a secret without echoing it.
   *
   * Readline echoes the typed characters into its output, so the output is
   * swapped for a discarding stream while the secret is read.
   */
  async askSecret(question: string): Promise<string> {
    if (!this.terminal) {
      // A pipe has no terminal echo, so the secret cannot leak.
      this.streams.output.write(question);
      const line = await this.readLine();
      this.streams.output.write("\n");
      return line;
    }

    // The promise flavour of `readline.Interface` exposes `output` at
    // runtime but does not declare it in its type.
    const rl = this.rl as unknown as ReadlineWithOutput;
    const originalOutput = rl.output;

    this.streams.output.write(question);
    rl.output = discardingOutput();

    try {
      return await this.rl.question("");
    } finally {
      rl.output = originalOutput;
      this.streams.output.write("\n");
    }
  }

  private readLine(): Promise<string> {
    const queued = this.queuedLines.shift();

    if (queued !== undefined) {
      return Promise.resolve(queued);
    }

    return new Promise<string>((resolve) => {
      this.waitingLines.push(resolve);
    });
  }

  close(): void {
    this.rl.close();
  }
}
