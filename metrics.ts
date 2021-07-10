import Site from "./site.ts";
import { Page } from "./filesystem.ts";
import { brightGreen, gray } from "./deps/colors.ts";
import { dirname, join } from "./deps/path.ts";
import { ensureDir } from "./deps/fs.ts";

/**
 * Class to collect and return performance metrics
 */
export default class Metrics {
  site: Site;

  constructor(site: Site) {
    this.site = site;
  }

  /**
   * Create a mark to start to measure
   */
  start(
    name: string,
    details?: Record<string, unknown>,
  ): (extra?: Record<string, unknown>) => void {
    if (this.site.options.metrics) {
      const markName = this.#getMarkName(name, details);
      performance.mark(markName);
      return (extra = {}) => {
        performance.measure(markName, {
          start: markName,
          detail: { name, ...details, ...extra },
        });
      };
    }

    return () => {};
  }

  #getMarkName(name: string, details?: Record<string, unknown>): string {
    if (!details) {
      return name;
    }

    const data = { ...details };

    if (data.page && data.page instanceof Page) {
      data.page = data.page.src.path + data.page.src.ext;
    }

    return `${name}: ${[...Object.values(data)].join(" ")}`;
  }

  /**
   * Return the list of collected metrics
   */
  get entries() {
    return performance.getEntriesByType("measure");
  }

  async finish() {
    const { metrics } = this.site.options;

    if (typeof metrics === "string") {
      await this.save(metrics);
    } else if (metrics) {
      this.print();
    }

    // Clear all data
    performance.clearMarks();
    performance.clearMeasures();
  }

  /**
   * Print the metrics in the console
   */
  print() {
    // Sort by duration and get the 100 longest
    const metrics = this.entries
      .sort((a, b) => a.duration - b.duration)
      .slice(-100);

    console.log();
    console.log(`⏲ Metrics data:`);
    console.log();

    for (const metric of metrics) {
      const duration = Math.round(metric.duration) + "ms";
      const [name, file] = metric.name.split(": ");

      console.log(
        `${brightGreen(duration.padStart(10))} ${name} ${gray(file || "")}`,
      );
    }
  }

  /**
   * Save the metrics data in a file
   */
  async save(file: string) {
    const path = join(this.site.options.cwd, file);
    await ensureDir(dirname(path));

    function replacer(key: string, value: unknown) {
      if (key === "page") {
        const page = value as Page;

        return {
          src: page.src.path + page.src.ext,
          dest: page.dest.path + page.dest.ext,
        };
      }
      return value;
    }

    await Deno.writeTextFile(
      path,
      JSON.stringify(this.entries, replacer, "  "),
    );

    if (!this.site.options.quiet) {
      console.log();
      console.log(`⏲ ${brightGreen("Metrics data saved in")} ${gray(path)}`);
      console.log();
    }
  }
}
