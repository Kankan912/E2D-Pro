import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders with text content", () => {
    const { getByText } = render(<Badge>Test Badge</Badge>);
    expect(getByText("Test Badge")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { getByText } = render(<Badge className="custom-class">Styled</Badge>);
    expect(getByText("Styled")).toHaveClass("custom-class");
  });

  it("renders with secondary variant", () => {
    const { getByText } = render(<Badge variant="secondary">Secondary</Badge>);
    expect(getByText("Secondary")).toBeInTheDocument();
  });

  it("renders with destructive variant", () => {
    const { getByText } = render(<Badge variant="destructive">Destructive</Badge>);
    expect(getByText("Destructive")).toBeInTheDocument();
  });
});
