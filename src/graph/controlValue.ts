import type { GraphNodeV01 } from "@skenion/contracts";
import type { RuntimeControlValue } from "../runtime/types";
import { isBoolValueNode, readBoolValueParam } from "./boolValue";
import { isColorRgbaNode, readColorRgbaParam } from "./colorRgba";
import { isFloatValueNode, readFloatValueParam } from "./floatValue";
import { isIntValueNode, readIntValueParam } from "./intValue";

export function runtimeControlValueForNode(node: GraphNodeV01): RuntimeControlValue | null {
  if (isFloatValueNode(node)) {
    return {
      type: "f32",
      value: readFloatValueParam(node)
    };
  }
  if (isIntValueNode(node)) {
    return {
      type: "i32",
      value: readIntValueParam(node)
    };
  }
  if (isBoolValueNode(node)) {
    return {
      type: "bool",
      value: readBoolValueParam(node)
    };
  }
  if (isColorRgbaNode(node)) {
    return {
      type: "rgba",
      value: readColorRgbaParam(node)
    };
  }

  return null;
}
