import { Component } from "react";
import { Button } from "../ui/Button.jsx";

/** Last line of defence: a render crash shows a friendly screen, never a blank page or a stack trace. */
export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Unhandled UI error:", error); // details stay in the browser console only
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-ink-2">The page hit an unexpected problem. Reloading usually fixes it.</p>
        <Button onClick={() => window.location.assign("/")}>Reload the app</Button>
      </div>
    );
  }
}
