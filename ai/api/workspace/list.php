<?php
require __DIR__ . "/_bootstrap.php";

function scan_tree($dir, $base = "") {
    $items = [];
    $list = scandir($dir);

    foreach ($list as $name) {
        if ($name === "." || $name === "..") continue;
        if (is_hidden_name($name) || skip_name($name)) continue;

        $full = $dir . "/" . $name;
        $rel = $base === "" ? $name : ($base . "/" . $name);

        if (is_dir($full)) {
            $items[] = [
                "type" => "dir",
                "name" => $name,
                "path" => $rel,
                "children" => scan_tree($full, $rel)
            ];
        } else {
            if (!is_allowed_text_file($full)) continue;

            $items[] = [
                "type" => "file",
                "name" => $name,
                "path" => $rel
            ];
        }
    }

    usort($items, function ($a, $b) {
        if ($a["type"] !== $b["type"]) {
            return $a["type"] === "dir" ? -1 : 1;
        }
        return strcasecmp($a["name"], $b["name"]);
    });

    return $items;
}

json_out([
    "items" => scan_tree(WORKSPACE_ROOT)
]);