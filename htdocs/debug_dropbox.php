<?php
function formatDirectDownloadUrl($url) {
    // Current Logic
    if (strpos($url, 'dropbox.com') !== false) {
         if (strpos($url, '?dl=0') !== false) {
             return str_replace('?dl=0', '?dl=1', $url);
         }
         if (strpos($url, '?dl=') === false) {
             return $url . '?dl=1'; // This is likely the bug
         }
    }
    return $url;
}

$userUrl = "https://www.dropbox.com/scl/fi/tdb3fgqb8gpfaj90sfnk8/101TBD_SKY-BLUE-_-1.jpg?rlkey=do806lwonbjckid8xc4fhjxlu&st=nijmaljq&dl=0";
$converted = formatDirectDownloadUrl($userUrl);

echo "Original: $userUrl\n";
echo "Converted: $converted\n";

// Proposed Fix
function formatDirectDownloadUrlFix($url) {
    if (strpos($url, 'dropbox.com') !== false) {
        $parsed = parse_url($url);
        $query = [];
        if (isset($parsed['query'])) {
            parse_str($parsed['query'], $query);
        }
        $query['dl'] = '1'; // Force dl=1
        
        $newQuery = http_build_query($query);
        return $parsed['scheme'] . '://' . $parsed['host'] . $parsed['path'] . '?' . $newQuery;
    }
    return $url;
}

$fixed = formatDirectDownloadUrlFix($userUrl);
echo "Fixed: $fixed\n";
?>
