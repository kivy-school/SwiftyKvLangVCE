import Foundation
import JavaScriptKit
import KvParser
//import KvToPyClass
import KivyWidgetRegistry
import MonacoApi
import MonacoJSK

func log(_ message: String) {
    _ = JSObject.global.console.log(message)
}

@main
struct KvToPyClassVsCodeExtension {
    static func main() {
        exposeGlobalFunctions()
        // Monaco completion provider would be registered here
        // but it requires monaco.languages which may not be available at init time
        log("✅ KV to VSCode Extension WASM loaded")
    }
    
    static func exposeGlobalFunctions() {
        // Expose extractSymbols function
        let extractSymbolsFunc = JSClosure { args in
            log("extractSymbolsFunc called args count: \(args.count)")
            guard args.count > 0, let kvCode = args[0].string else {
                return "[]".jsValue
            }
            return extractSymbols(kvCode: kvCode).jsValue
        }
        JSObject.global.extractKvSymbols = .object(extractSymbolsFunc)
        
        // Expose completion function
        let completionFunc = JSClosure { args in
            log("completionFunc called args count: \(args.count)")
            guard args.count >= 3,
                  let kvCode = args[0].string,
                  let line = args[1].number,
                  let character = args[2].number else {
                return [JSValue]().jsValue
            }
            return KvCompletionProvider.getCompletions(kvCode: kvCode, line: Int(line), character: Int(character))
        }
        JSObject.global.getKvCompletions = .object(completionFunc)
        
        // Expose generatePythonClasses function  
//        let generateFunc = JSClosure { args in
//            guard args.count >= 1, let kvCode = args[0].string else {
//                return "# Error: No KV code provided".jsValue
//            }
//            let pythonCode = args.count >= 2 ? (args[1].string ?? "") : ""
//            return generatePythonClasses(kvCode: kvCode, pythonCode: pythonCode).jsValue
//        }
//        JSObject.global.generatePythonClassesFromKv = .object(generateFunc)
        
        // Expose addWidgetToKv function
        let addWidgetFunc = JSClosure { args in
            guard args.count >= 4,
                  let kvCode = args[0].string,
                  let widgetSnippet = args[1].string,
                  let line = args[2].number,
                  let column = args[3].number else {
                return "{\"success\": false, \"error\": \"Invalid arguments\"}".jsValue
            }
            return addWidgetToKv(kvCode: kvCode, widgetSnippet: widgetSnippet, line: Int(line), column: Int(column)).jsValue
        }
        JSObject.global.addWidgetToKv = .object(addWidgetFunc)

    }
    
    // Extract symbols for outline view
    static func extractSymbols(kvCode: String) -> String {
        do {
            let tokenizer = KvTokenizer(source: kvCode)
            let tokens = try tokenizer.tokenize()
            let parser = KvParser(tokens: tokens)
            let module = try parser.parse()
            
            var documentSymbols: [DocumentSymbol] = []
            
            // Extract symbols from rules
            for rule in module.rules {
                let ruleName = rule.selector.primaryName
                var children: [DocumentSymbol] = []
                
                // Extract properties with type info and value
                for prop in rule.properties {
                    let kind: SymbolKind = prop.name.hasPrefix("on_") ? .event : .property
                    let propType = KivyWidgetRegistry.getPropertyType(prop.name, on: ruleName)
                    let typeStr = propType?.rawValue ?? "Property"
                    let range = IDERange.from(line: prop.line, column: 1, length: prop.name.count)
                    
                    // Create value child symbol
                    var propChildren: [DocumentSymbol]?
                    if !prop.value.isEmpty {
                        let valueRange = IDERange.from(line: prop.line, column: 1, length: 5)
                        propChildren = [DocumentSymbol(
                            name: "value: \(prop.value)",
                            detail: nil,
                            kind: .string,
                            range: valueRange,
                            selectionRange: valueRange
                        )]
                    }
                    
                    children.append(DocumentSymbol(
                        name: prop.name,
                        detail: typeStr,
                        kind: kind,
                        range: range,
                        selectionRange: range,
                        children: propChildren
                    ))
                }
                
                // Extract handlers
                for handler in rule.handlers {
                    let range = IDERange.from(line: handler.line, column: 1, length: handler.name.count)
                    children.append(DocumentSymbol(
                        name: handler.name,
                        detail: "event handler",
                        kind: .event,
                        range: range,
                        selectionRange: range
                    ))
                }
                
                // Extract child widgets
                for widget in rule.children {
                    children.append(contentsOf: extractWidgetSymbols(widget))
                }
                
                // Extract canvas instructions
                if let canvas = rule.canvas {
                    children.append(contentsOf: extractCanvasSymbols(canvas, name: "canvas"))
                }
                if let canvasBefore = rule.canvasBefore {
                    children.append(contentsOf: extractCanvasSymbols(canvasBefore, name: "canvas.before"))
                }
                if let canvasAfter = rule.canvasAfter {
                    children.append(contentsOf: extractCanvasSymbols(canvasAfter, name: "canvas.after"))
                }
                
                let range = IDERange.from(line: rule.line, column: 1, length: ruleName.count)
                documentSymbols.append(DocumentSymbol(
                    name: ruleName,
                    detail: "rule",
                    kind: .class,
                    range: range,
                    selectionRange: range,
                    children: children.isEmpty ? nil : children
                ))
            }
            
            // Extract root widget (outside rules)
            if let rootWidget = module.root {
                documentSymbols.append(contentsOf: extractWidgetSymbols(rootWidget))
            }
            
            let encoder = JSONEncoder()
            let jsonData = try encoder.encode(documentSymbols)
            return String(data: jsonData, encoding: .utf8) ?? "[]"
            
        } catch let error as NSError {
            log("Error extracting symbols: \(error.localizedDescription)")
            return "[]"
        } catch {
            log("Error extracting symbols: \(error)")
            return "[]"
        }
    }
    
    private static func extractWidgetSymbols(_ widget: KvWidget) -> [DocumentSymbol] {
        let canvasInstructions: Swift.Set<String> = [
            "Color", "Rectangle", "Ellipse", "Line", "Point", "Mesh", "Triangle", "Quad",
            "Bezier", "StencilPush", "StencilPop", "StencilUse", "StencilUnUse",
            "Scale", "Rotate", "PushMatrix", "PopMatrix", "Translate"
        ]
        
        let isCanvas = canvasInstructions.contains(widget.name)
        let widgetName = widget.id != nil ? "\(widget.name) (id: \(widget.id!))" : widget.name
        let widgetDetail = isCanvas ? "canvas instruction" : "widget"
        let widgetKind: SymbolKind = isCanvas ? .constant : .object
        
        var children: [DocumentSymbol] = []
        
        // Extract properties with type info and value
        for prop in widget.properties {
            let kind: SymbolKind
            let detail: String
            
            if prop.name.hasPrefix("on_") {
                kind = .event
                detail = "event handler"
            } else if prop.name == "id" {
                kind = .key
                detail = "identifier"
            } else {
                kind = .property
                // Check if this is a canvas instruction parameter or a widget property
                if isCanvas {
                    let paramType = KivyCanvasInstructionRegistry.getParameterType(prop.name, on: widget.name)
                    detail = paramType?.rawValue ?? "parameter"
                } else {
                    let propType = KivyWidgetRegistry.getPropertyType(prop.name, on: widget.name)
                    detail = propType?.rawValue ?? "Property"
                }
            }
            
            // Create value child symbol
            var propChildren: [DocumentSymbol]?
            if !prop.value.isEmpty && !prop.name.hasPrefix("on_") {
                let valueRange = IDERange.from(line: prop.line, column: 1, length: 5)
                propChildren = [DocumentSymbol(
                    name: "value: \(prop.value)",
                    detail: nil,
                    kind: .string,
                    range: valueRange,
                    selectionRange: valueRange
                )]
            }
            
            let range = IDERange.from(line: prop.line, column: 1, length: prop.name.count)
            children.append(DocumentSymbol(
                name: prop.name,
                detail: detail,
                kind: kind,
                range: range,
                selectionRange: range,
                children: propChildren
            ))
        }
        
        // Extract handlers
        for handler in widget.handlers {
            let range = IDERange.from(line: handler.line, column: 1, length: handler.name.count)
            children.append(DocumentSymbol(
                name: handler.name,
                detail: "event handler",
                kind: .event,
                range: range,
                selectionRange: range
            ))
        }
        
        // Extract child widgets recursively
        for childWidget in widget.children {
            children.append(contentsOf: extractWidgetSymbols(childWidget))
        }
        
        // Extract canvas instructions
        if let canvas = widget.canvas {
            children.append(contentsOf: extractCanvasSymbols(canvas, name: "canvas"))
        }
        if let canvasBefore = widget.canvasBefore {
            children.append(contentsOf: extractCanvasSymbols(canvasBefore, name: "canvas.before"))
        }
        if let canvasAfter = widget.canvasAfter {
            children.append(contentsOf: extractCanvasSymbols(canvasAfter, name: "canvas.after"))
        }
        
        let range = IDERange.from(line: widget.line, column: 1, length: widgetName.count)
        return [DocumentSymbol(
            name: widgetName,
            detail: widgetDetail,
            kind: widgetKind,
            range: range,
            selectionRange: range,
            children: children.isEmpty ? nil : children
        )]
    }
    
    private static func extractCanvasSymbols(_ canvas: KvCanvas, name: String) -> [DocumentSymbol] {
        var children: [DocumentSymbol] = []
        
        // Extract canvas instructions
        for instruction in canvas.instructions {
            var instrChildren: [DocumentSymbol] = []
            
            // Extract instruction properties with value
            for prop in instruction.properties {
                var propChildren: [DocumentSymbol]?
                if !prop.value.isEmpty {
                    let valueRange = IDERange.from(line: prop.line, column: 1, length: 5)
                    propChildren = [DocumentSymbol(
                        name: "value: \(prop.value)",
                        detail: nil,
                        kind: .string,
                        range: valueRange,
                        selectionRange: valueRange
                    )]
                }
                
                // Get parameter type from canvas instruction registry
                let paramType = KivyCanvasInstructionRegistry.getParameterType(prop.name, on: instruction.instructionType)
                let typeStr = paramType?.rawValue ?? "parameter"
                
                let range = IDERange.from(line: prop.line, column: 1, length: prop.name.count)
                instrChildren.append(DocumentSymbol(
                    name: prop.name,
                    detail: typeStr,
                    kind: .property,
                    range: range,
                    selectionRange: range,
                    children: propChildren
                ))
            }
            
            let instrRange = IDERange.from(line: instruction.line, column: 1, length: instruction.instructionType.count)
            children.append(DocumentSymbol(
                name: instruction.instructionType,
                detail: "canvas instruction",
                kind: .constant,
                range: instrRange,
                selectionRange: instrRange,
                children: instrChildren.isEmpty ? nil : instrChildren
            ))
        }
        
        let range = IDERange.from(line: canvas.line, column: 1, length: name.count)
        return [DocumentSymbol(
            name: name,
            detail: "canvas block",
            kind: .namespace,
            range: range,
            selectionRange: range,
            children: children.isEmpty ? nil : children
        )]
    }
    
    // Add widget to KV code at specified position with collision detection
    static func addWidgetToKv(kvCode: String, widgetSnippet: String, line: Int, column: Int) -> String {
        log("[addWidget] Drop at line \(line), column \(column)")
        
        // Round column to nearest 4-space indent level
        let roundedIndent = (column / 4) * 4
        log("[addWidget] Rounded indent to \(roundedIndent)")
        
        // Insert widget at the specified position
        // line comes as 1-based from TypeScript, insertAtLine expects 0-based
        let newKvCode = insertWidgetIntoKvCode(
            kvCode: kvCode,
            widgetSnippet: widgetSnippet,
            insertAtLine: line - 1, // Convert to 0-based line index
            indent: roundedIndent
        )
        
        return jsonResponse(success: true, kvCode: newKvCode)
    }
    
    // Insert widget snippet into KV code at specified line with proper indentation
    private static func insertWidgetIntoKvCode(
        kvCode: String,
        widgetSnippet: String,
        insertAtLine: Int,
        indent: Int
    ) -> String {
        let lines = kvCode.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        var result: [String] = []
        
        // insertAtLine is 0-based index - insert AT this line (push existing line down)
        
        // Add lines before insertion point
        for i in 0..<min(insertAtLine, lines.count) {
            result.append(lines[i])
        }
        
        // Add the widget snippet with proper indentation
        let baseIndentStr = String(repeating: " ", count: indent)
        // Remove $0 placeholder from snippet
        let cleanedSnippet = widgetSnippet.replacingOccurrences(of: "$0", with: "")
        let snippetLines = cleanedSnippet.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        
        // Find the base indentation from the first non-empty line
        var baseSnippetIndent = 0
        for snippetLine in snippetLines {
            let trimmed = snippetLine.trimmingCharacters(in: .whitespaces)
            if !trimmed.isEmpty {
                // Count leading spaces
                if let firstNonSpace = snippetLine.firstIndex(where: { $0 != " " }) {
                    baseSnippetIndent = snippetLine.distance(from: snippetLine.startIndex, to: firstNonSpace)
                }
                break
            }
        }
        
        // Apply indentation preserving relative spacing
        for snippetLine in snippetLines {
            let trimmed = snippetLine.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty {
                // Skip empty lines
                continue
            } else {
                // Calculate this line's indentation relative to base
                var lineIndent = 0
                if let firstNonSpace = snippetLine.firstIndex(where: { $0 != " " }) {
                    lineIndent = snippetLine.distance(from: snippetLine.startIndex, to: firstNonSpace)
                }
                let relativeIndent = lineIndent - baseSnippetIndent
                let finalIndent = baseIndentStr + String(repeating: " ", count: max(0, relativeIndent))
                result.append(finalIndent + trimmed)
            }
        }
        
        // Add remaining lines (from insertAtLine onwards)
        for i in insertAtLine..<lines.count {
            result.append(lines[i])
        }
        
        return result.joined(separator: "\n")
    }
    
    private static func jsonResponse(success: Bool, kvCode: String? = nil, error: String? = nil) -> String {
        var obj: [String: Any] = ["success": success]
        if let kvCode = kvCode {
            obj["kvCode"] = kvCode
        }
        if let error = error {
            obj["error"] = error
        }
        
        let jsonData = try? JSONSerialization.data(withJSONObject: obj)
        return String(data: jsonData ?? Data(), encoding: .utf8) ?? "{}"
    }
    
    // Generate Python classes using the actual KvToPyClassGenerator
//    static func generatePythonClasses(kvCode: String, pythonCode: String) -> String {
//        do {
//            // Parse KV
//            let tokenizer = KvTokenizer(source: kvCode)
//            let tokens = try tokenizer.tokenize()
//            let parser = KvParser(tokens: tokens)
//            let module = try parser.parse()
//            
//            // Parse Python input to extract class definitions
//            let pythonParser = PythonClassParser(source: pythonCode)
//            let pythonClasses = pythonParser.parse()
//            
//            // Generate Python classes with information from both KV and Python code
//            let generator = KvToPyClassGenerator(module: module, pythonClasses: pythonClasses)
//            let generatedCode = try generator.generate()
//            
//            return generatedCode
//        } catch let error as KvParserError {
//            return "# Error parsing KV file:\n# \(error)"
//        } catch {
//            return "# Error generating Python classes:\n# \(error)"
//        }
//    }
}
