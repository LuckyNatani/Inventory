<?php
require_once '../config/db_connect.php';

header('Content-Type: application/json');

// Helper to get input
$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? ($input['action'] ?? '');
$user_id = $_GET['user_id'] ?? ($input['user_id'] ?? 0);

if (!$user_id) {
    echo json_encode(['success' => false, 'message' => 'User ID required']);
    exit;
}

switch ($action) {
    case 'get_all':
        $stmt = $mysqli->prepare("SELECT setting_key, setting_value, setting_group FROM user_settings WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $settings = [];
        while ($row = $result->fetch_assoc()) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
        
        // Return defaults if not set
        $defaults = [
            'slow_moving_qty' => 100,
            'slow_moving_days' => 90,
            'dead_stock_qty' => 0,
            'dead_stock_days' => 90
        ];
        
        foreach ($defaults as $key => $val) {
            if (!isset($settings[$key])) {
                $settings[$key] = $val;
            }
        }
        
        echo json_encode(['success' => true, 'data' => $settings]);
        break;

    case 'update':
        $settings = $input['settings'] ?? [];
        if (empty($settings)) {
            echo json_encode(['success' => false, 'message' => 'No settings provided']);
            exit;
        }

        $stmt = $mysqli->prepare("INSERT INTO user_settings (user_id, setting_key, setting_value, setting_group) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        
        foreach ($settings as $key => $value) {
            $group = 'general';
            if (in_array($key, ['slow_moving_qty', 'slow_moving_days', 'dead_stock_qty', 'dead_stock_days'])) {
                $group = 'stock_logic';
            }
            $stmt->bind_param("isss", $user_id, $key, $value, $group);
            $stmt->execute();
        }
        
        echo json_encode(['success' => true, 'message' => 'Settings updated']);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}
?>
