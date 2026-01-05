// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SwiftyKvLangVCE",
    platforms: [.macOS(.v13)],
    products: [
        .executable(
            name: "SwiftyKvLangVCE",
            targets: ["SwiftyKvLangVCE"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/swiftwasm/JavaScriptKit", from: "0.19.0"),
        .package(url: "https://github.com/Py-Swift/SwiftyKvLang", branch: "master"),
        .package(url: "https://github.com/Py-Swift/PySwiftAST", branch: "master"),
        .package(url: "https://github.com/Py-Swift/JavaScriptKitExtensions", branch: "master"),
        //.package(path: "../KvToPyClass"),
        .package(url: "https://github.com/Py-Swift/VSCodeMonacoApi", branch: "master")
    ],
    targets: [
        .executableTarget(
            name: "SwiftyKvLangVCE",
            dependencies: [
                .product(name: "JavaScriptKit", package: "JavaScriptKit"),
                .product(name: "KvParser", package: "SwiftyKvLang"),
                //.product(name: "KvToPyClass", package: "KvToPyClass"),
                .product(name: "KivyWidgetRegistry", package: "SwiftyKvLang"),
                .product(name: "MonacoApi", package: "VSCodeMonacoApi"),
                .product(name: "MonacoJSK", package: "VSCodeMonacoApi"),
                .byName(name: "JavaScriptKitExtensions")
            ],
            swiftSettings: [
                .unsafeFlags(["-Xfrontend", "-disable-availability-checking"])
            ]
        )
    ]
)
