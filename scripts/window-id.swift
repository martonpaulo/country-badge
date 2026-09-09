// Prints the CGWindowID of the on-screen windows owned by a given process id,
// largest first. The capture script launches the browser itself, so the window
// is identified by the process it started rather than guessed from a title.
import CoreGraphics
import Foundation

guard CommandLine.arguments.count == 2,
      let targetPid = Int(CommandLine.arguments[1]) else {
    FileHandle.standardError.write("usage: window-id <pid>\n".data(using: .utf8)!)
    exit(2)
}

guard let windows = CGWindowListCopyWindowInfo(
    [.optionOnScreenOnly, .excludeDesktopElements],
    kCGNullWindowID
) as? [[String: Any]] else {
    exit(1)
}

let owned = windows.compactMap { window -> (id: Int, area: Double)? in
    guard let pid = window[kCGWindowOwnerPID as String] as? Int, pid == targetPid,
          let id = window[kCGWindowNumber as String] as? Int,
          let bounds = window[kCGWindowBounds as String] as? [String: Any],
          let width = bounds["Width"] as? Double,
          let height = bounds["Height"] as? Double,
          width > 100, height > 100 else {
        return nil
    }

    return (id: id, area: width * height)
}

if owned.isEmpty {
    exit(1)
}

for window in owned.sorted(by: { $0.area > $1.area }) {
    print(window.id)
}
