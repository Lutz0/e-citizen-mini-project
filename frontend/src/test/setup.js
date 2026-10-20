import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

// jsdom doesn't implement the modal <dialog> API; a tiny stand-in is enough for our Modal.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ||= function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ||= function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
