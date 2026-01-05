import Foundation
import JavaScriptKit
import MonacoApi
import MonacoJSK
import KvParser
//import KvToPyClass
import KivyWidgetRegistry
import JavaScriptKitExtensions

/// Provides code completion for KV language
struct KvCompletionProvider {
    
    /// Get completions for VSCode
    static func getCompletions(kvCode: String, line: Int, character: Int) -> JSValue {
        log("getCompletions called: line=\(line), char=\(character)")
        
        // Split into lines
        let lines = kvCode.components(separatedBy: .newlines)
        guard line >= 0, line < lines.count else {
            log("Line \(line) out of bounds (total: \(lines.count))")
            return [CompletionItem]().jsValue
        }
        
        let lineContent = lines[line]
        log("Line content: '\(lineContent)'")
        
        let textBeforeCursor = String(lineContent.prefix(character))
        log("Text before cursor: '\(textBeforeCursor)'")
        
        let trimmed = textBeforeCursor.trimmingCharacters(in: .whitespaces)
        log("Trimmed: '\(trimmed)'")
        
        var completions: [CompletionItem] = []
        
        // Check context for widget completion
        if !trimmed.contains(":") {
            // Before colon - provide widget completions
            log("Context: widget name completion (no colon yet)")
            completions.append(contentsOf: getWidgetCompletions())
        } else if trimmed.contains("<") && !trimmed.contains(">") {
            log("Context: class definition completion")
            completions.append(contentsOf: getWidgetCompletions(forClassDefinition: true))
        } else if trimmed.contains(":") && !trimmed.hasSuffix(":") {
            log("Context: property value completion")
            completions.append(contentsOf: getPropertyValueCompletions(line: lineContent))
        } else {
            log("Context: no match, no completions")
        }
        
        log("Generated \(completions.count) completions")
        

        return completions.jsValue
        // let completionList = CompletionList(
        //     suggestions: completions,
        //     incomplete: false,
        //     dispose: nil
        // )
        
        // return completionList.jsValue
    }
    
    /// Get widget completions as dictionary objects
    private static func getWidgetCompletions(forClassDefinition: Bool = false) -> [CompletionItem] {
        var completions: [CompletionItem] = []
        
        // Use actual KivyWidget enum from registry
        let allWidgets = KivyWidget.allCases.sorted { $0.rawValue < $1.rawValue }
        
        for widget in allWidgets {
            let widgetName = widget.rawValue
            let info = KivyWidgetRegistry.getWidgetInfo(widget)
            
            // Skip behaviors for regular widget completion (unless in class def)
            if !forClassDefinition && widgetName.hasSuffix("Behavior") {
                continue
            }
            
            // Get base classes for detail
            let baseClasses = info?.baseClasses.map { $0.rawValue }.joined(separator: ", ") ?? ""
            let detail = baseClasses.isEmpty ? "Widget" : "Inherits: \(baseClasses), \(forClassDefinition ? "Widget" : "")"
            
            if forClassDefinition {
                completions.append(CompletionItem(
                    label: widgetName,
                    kind: .class,
                    detail: detail,
                    documentation: .plainText("Kivy \(widgetName) widget (class definition)"),
                    insertText: .plainText(widgetName),
                    insertTextFormat: .plainText
                ))
            } else {
                // Snippet with placeholders for widget's own properties
                let indent = "    "
                var snippetLines: [String] = ["\(widgetName):"]
                
                // Get direct properties (not inherited)
                let properties = info?.directProperties.sorted { $0.name < $1.name } ?? []
                
                if properties.isEmpty {
                    snippetLines.append("\(indent)${1:# properties}")
                } else {
                    for (index, prop) in properties.enumerated() {
                        let placeholder = index + 1
                        snippetLines.append("\(indent)\(prop.name): ${\(placeholder)}")
                    }
                }
                
                let snippet = snippetLines.joined(separator: "\n")
                let item = CompletionItem(
                    label: widgetName,
                    labelDetails: nil,
                    kind: .snippet,
                    tags: nil,
                    detail: detail,
                    documentation: .plainText("Kivy \(widgetName) widget"),
                    insertText: .snippet(.init(value: snippet)),
                    insertTextFormat: .snippet,
                    insertTextRules: .insertAsSnippet
                )
                //log("Created completion: label=\(widgetName), insertTextFormat=\(item.insertTextFormat?.rawValue ?? -1), insertTextRules=\(item.insertTextRules?.rawValue ?? -1)")
                completions.append(item)
            }
        }
        
        return completions
    }
    
    /// Get property value completions
    private static func getPropertyValueCompletions(line: String) -> [CompletionItem] {
        var completions: [CompletionItem] = []
        
        // Common boolean values
        if line.contains("True") || line.contains("False") || line.contains(":") {
            completions.append(CompletionItem(
                label: "True",
                kind: .constant,
                detail: "Boolean value",
                insertText: .plainText("True"),
                insertTextFormat: .plainText
            ))
            completions.append(CompletionItem(
                label: "False",
                kind: .constant,
                detail: "Boolean value",
                insertText: .plainText("False"),
                insertTextFormat: .plainText
            ))
        }
        
        // Orientation values
        if line.contains("orientation") {
            completions.append(CompletionItem(
                label: "'vertical'",
                kind: .value,
                detail: "Vertical orientation",
                insertText: .plainText("'vertical'"),
                insertTextFormat: .plainText
            ))
            completions.append(CompletionItem(
                label: "'horizontal'",
                kind: .value,
                detail: "Horizontal orientation",
                insertText: .plainText("'horizontal'"),
                insertTextFormat: .plainText
            ))
        }
        
        // Size hint values
        if line.contains("size_hint") {
            completions.append(CompletionItem(
                label: "None, None",
                kind: .value,
                detail: "No size hint",
                insertText: .plainText("None, None"),
                insertTextFormat: .plainText
            ))
            completions.append(CompletionItem(
                label: "1, 1",
                kind: .value,
                detail: "Full size hint",
                insertText: .plainText("1, 1"),
                insertTextFormat: .plainText
            ))
        }
        
        return completions
    }
}
