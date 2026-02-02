<?php
require_once 'config/db_connect.php';
$result = $mysqli->query("DESCRIBE sku_costings");
while ($row = $result->fetch_assoc()) {
    print_r($row);
}
?>
