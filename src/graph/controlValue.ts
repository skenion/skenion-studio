import type { DisplayGraphNodeV01 } from "./patchLibrary";
import type { RuntimeControlValue } from "../runtime/types";
import { isBoolValueNode, readBoolValueParam } from "./boolValue";
import { isColorRgbaNode, readColorRepresentationParam, readColorRgbaParam, readColorSpaceParam } from "./colorRgba";
import { isFloatValueNode, readFloatRepresentationParam, readFloatValueParam } from "./floatValue";
import { isIntValueNode, readIntRepresentationParam, readIntValueParam } from "./intValue";
import { isMessageNode, readMessageValueParam } from "./messageNode";
import { isStringValueNode, readStringValueParam } from "./stringValue";
import { isUIntValueNode, readUIntRepresentationParam, readUIntValueParam } from "./uintValue";

export function runtimeControlValueForNode(node: DisplayGraphNodeV01): RuntimeControlValue | null {
  if (isFloatValueNode(node)) {
    return {
      type: "float",
      representation: readFloatRepresentationParam(node),
      value: readFloatValueParam(node)
    };
  }
  if (isIntValueNode(node)) {
    return {
      type: "int",
      representation: readIntRepresentationParam(node),
      value: readIntValueParam(node)
    };
  }
  if (isUIntValueNode(node)) {
    return {
      type: "uint",
      representation: readUIntRepresentationParam(node),
      value: readUIntValueParam(node)
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
      type: "color",
      representation: readColorRepresentationParam(node),
      colorSpace: readColorSpaceParam(node),
      value: readColorRgbaParam(node)
    };
  }
  if (isStringValueNode(node)) {
    return {
      type: "string",
      value: readStringValueParam(node)
    };
  }
  if (isMessageNode(node)) {
    return {
      type: "string",
      value: readMessageValueParam(node)
    };
  }

  return null;
}
