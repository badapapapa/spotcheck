"use client";

import { Component, type ReactNode } from "react";

type Props = {
  /** What failed, for the message: "the comparison", "these charts". */
  what: string;
  /**
   * The plan the section shows (its URL query). A new plan clears the
   * error, so editing the scenario is always a way out.
   */
  resetKey: string;
  children: ReactNode;
};

type State = { error: Error | null; key: string };

/**
 * An error boundary around one results section. If a chart throws, only
 * that section is replaced, so the converter above stays usable: the plan
 * can be changed, and Try again renders the same plan again. (React only
 * offers error boundaries as class components.)
 */
export class SectionBoundary extends Component<Props, State> {
  override state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  // A different plan than the one that failed: show it afresh.
  static getDerivedStateFromProps(
    props: Props,
    state: State,
  ): Partial<State> | null {
    return props.resetKey === state.key
      ? null
      : { error: null, key: props.resetKey };
  }

  override componentDidCatch(error: Error) {
    console.error(`SpotCheck couldn't show ${this.props.what}:`, error);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="mt-8 rounded-lg border bg-surface p-4 sm:p-6"
        data-testid="section-error"
      >
        <p className="t-h3">SpotCheck couldn&apos;t show {this.props.what}</p>
        <p className="prose-measure mt-2 text-muted-foreground">
          The rest of the page still works. Try again, or change the plan above.
          Nothing was saved.
        </p>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
