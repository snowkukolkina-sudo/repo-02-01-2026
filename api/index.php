<?php
// Отключаем вывод ошибок в HTML
error_reporting(0);
ini_set('display_errors', 0);

// Устанавливаем CORS заголовки
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Определяем путь для проверки, нужны ли JSON заголовки
$request_uri = $_SERVER['HTTP_X_ORIGINAL_URI'] ?? $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$path = str_replace('/api/', '', $path);
$path = ltrim($path, '/');

// Устанавливаем JSON заголовки только если это не экспорт
if (!preg_match('/^(products\/export\/yml|onec\/export|diadoc\/export\/|inventory\/export\/)/', $path)) {
    header('Content-Type: application/json; charset=utf-8');
}

function handleTechcardsComponents($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }

    try {
        $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_column($columns, 'name');

        $hasDisplayOnly = in_array('display_only', $columnNames, true);
        $hasSkipInventory = in_array('skip_inventory', $columnNames, true);
        $hasIsActive = in_array('is_active', $columnNames, true);
        $hasUnit = in_array('unit', $columnNames, true);
        $hasAccountCode = in_array('account_code', $columnNames, true);
        $hasSku = in_array('sku', $columnNames, true);
        $hasPurchasePrice = in_array('purchase_price', $columnNames, true);
        $hasCost = in_array('cost', $columnNames, true);
        $hasType = in_array('type', $columnNames, true);

        if (!$hasAccountCode) {
            echo json_encode(['success' => true, 'data' => []]);
            return;
        }

        $where = [];
        $where[] = "account_code LIKE '10%'";
        if ($hasDisplayOnly) {
            $where[] = "COALESCE(display_only, 0) = 0";
        }
        if ($hasSkipInventory) {
            $where[] = "COALESCE(skip_inventory, 0) = 0";
        }
        if ($hasIsActive) {
            $where[] = "COALESCE(is_active, 1) = 1";
        }

        $select = [
            'id',
            'name',
            ($hasSku ? 'sku' : "'' AS sku"),
            ($hasUnit ? 'unit' : "'' AS unit"),
            ($hasAccountCode ? 'account_code' : "'' AS account_code"),
            ($hasType ? 'type' : "'product' AS type"),
            "COALESCE(" . ($hasPurchasePrice ? 'purchase_price' : 'NULL') . ", " . ($hasCost ? 'cost' : 'NULL') . ", price, 0) AS cost_price"
        ];

        $sql = "SELECT " . implode(', ', $select) . " FROM products";
        if (!empty($where)) {
            $sql .= " WHERE " . implode(' AND ', $where);
        }
        $sql .= " ORDER BY name";

        $stmt = $pdo->query($sql);
        $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

        // Приводим тип компонента (ingredient/semi) из account_code
        foreach ($rows as &$r) {
            $acc = strtolower(trim((string)($r['account_code'] ?? '')));
            if (strpos($acc, '10.2') === 0) {
                $r['component_type'] = 'semi';
            } else {
                $r['component_type'] = 'ingredient';
            }
        }

        echo json_encode(['success' => true, 'data' => $rows]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function normalizeNullableInt($value) {
    if ($value === null) return null;
    if ($value === '') return null;
    if ($value === false) return null;
    if (is_string($value) && trim($value) === '') return null;
    $n = intval($value);
    return $n > 0 ? $n : null;
}

function normalizeBoolInt($value) {
    if ($value === true) return 1;
    if ($value === false) return 0;
    if ($value === null) return 0;
    if (is_numeric($value)) return intval($value) ? 1 : 0;
    $v = mb_strtolower(trim((string)$value), 'UTF-8');
    if ($v === '1' || $v === 'true' || $v === 'yes' || $v === 'да' || $v === 'on') return 1;
    return 0;
}

function isTerminalOrderStatus($status) {
    $s = mb_strtolower(trim((string)$status), 'UTF-8');
    if ($s === '') return false;
    $terminal = ['completed', 'done', 'finished', 'cancelled', 'canceled', 'rejected', 'refunded'];
    return in_array($s, $terminal, true);
}

function orderItemsContainProductId($items, $productId) {
    $pid = intval($productId);
    if ($pid <= 0) return false;
    if (!is_array($items)) return false;
    foreach ($items as $it) {
        if (!is_array($it)) continue;
        $id = normalizeNullableInt($it['id'] ?? null);
        $productId2 = normalizeNullableInt($it['productId'] ?? $it['product_id'] ?? null);
        $variantId = normalizeNullableInt($it['variantId'] ?? $it['variant_id'] ?? $it['variantID'] ?? null);
        if ($id !== null && $id === $pid) return true;
        if ($productId2 !== null && $productId2 === $pid) return true;
        if ($variantId !== null && $variantId === $pid) return true;
    }
    return false;
}

function countActiveOrdersUsingProduct($pdo, $productId) {
    $pid = intval($productId);
    if ($pid <= 0) return ['count' => 0, 'order_ids' => []];
    try {
        $stmt = $pdo->query("SELECT id, status, items FROM orders ORDER BY id DESC");
        $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    } catch (Exception $e) {
        return ['count' => 0, 'order_ids' => []];
    }

    $count = 0;
    $ids = [];
    foreach ($rows as $r) {
        $status = $r['status'] ?? '';
        if (isTerminalOrderStatus($status)) continue;
        $items = json_decode($r['items'] ?? '[]', true);
        if (orderItemsContainProductId($items, $pid)) {
            $count++;
            $ids[] = intval($r['id'] ?? 0);
            if (count($ids) >= 50) break;
        }
    }
    return ['count' => $count, 'order_ids' => $ids];
}

function validateProductParentConstraints($pdo, $productId, $desiredParentId, $desiredIsShowcaseParent) {
    $pid = intval($productId);
    $parentId = normalizeNullableInt($desiredParentId);
    $isShowcase = normalizeBoolInt($desiredIsShowcaseParent) === 1;

    if ($isShowcase && $parentId !== null) {
        return ['ok' => false, 'error' => 'Showcase parent cannot have parent_product_id'];
    }

    if ($parentId === null) {
        return ['ok' => true];
    }
    if ($pid > 0 && $parentId === $pid) {
        return ['ok' => false, 'error' => 'parent_product_id cannot reference itself'];
    }

    $pStmt = $pdo->prepare("SELECT id, parent_product_id, is_showcase_parent, display_only FROM products WHERE id = ? LIMIT 1");
    $pStmt->execute([$parentId]);
    $parent = $pStmt->fetch(PDO::FETCH_ASSOC);
    if (!$parent) {
        return ['ok' => false, 'error' => 'Parent product not found'];
    }

    $parentIsShowcase = intval($parent['is_showcase_parent'] ?? 0) === 1 || intval($parent['display_only'] ?? 0) === 1;
    if (!$parentIsShowcase) {
        return ['ok' => false, 'error' => 'Parent must be a showcase product'];
    }

    // Cycle protection
    $walk = $parentId;
    for ($i = 0; $i < 50; $i++) {
        if ($pid > 0 && $walk === $pid) {
            return ['ok' => false, 'error' => 'Cyclic parent_product_id detected'];
        }
        $stmt = $pdo->prepare("SELECT parent_product_id FROM products WHERE id = ? LIMIT 1");
        $stmt->execute([$walk]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $next = $row ? normalizeNullableInt($row['parent_product_id'] ?? null) : null;
        if ($next === null) break;
        $walk = $next;
    }

    if ($isShowcase) {
        return ['ok' => false, 'error' => 'Variant cannot be marked as showcase parent'];
    }

    return ['ok' => true];
}

function handleProductVariants($pdo, $parentId, $variantId = null) {
    $method = $_SERVER['REQUEST_METHOD'];
    $parentId = intval($parentId);
    $variantId = $variantId !== null ? intval($variantId) : null;

    // Ensure columns exist (backward compatible)
    $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
    $columnNames = array_column($columns, 'name');
    $hasParentProductId = in_array('parent_product_id', $columnNames);
    $hasIsShowcaseParent = in_array('is_showcase_parent', $columnNames);

    if (!$hasParentProductId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Variants are not supported: missing parent_product_id column']);
        return;
    }

    // Parent must exist
    $pStmt = $pdo->prepare("SELECT * FROM products WHERE id = ? LIMIT 1");
    $pStmt->execute([$parentId]);
    $parent = $pStmt->fetch(PDO::FETCH_ASSOC);
    if (!$parent) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Parent product not found']);
        return;
    }

    switch ($method) {
        case 'GET':
            if ($variantId !== null) {
                $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ? AND parent_product_id = ? LIMIT 1");
                $stmt->execute([$variantId, $parentId]);
                $variant = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$variant) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Variant not found']);
                    return;
                }

                echo json_encode(['success' => true, 'data' => $variant]);
                return;
            }

            $stmt = $pdo->prepare("SELECT * FROM products WHERE parent_product_id = ? ORDER BY name");
            $stmt->execute([$parentId]);
            $variants = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $variants]);
            return;

        case 'POST':
            // Creating a variant under parent
            if ($hasIsShowcaseParent) {
                $isShowcase = intval($parent['is_showcase_parent'] ?? 0) === 1;
                if (!$isShowcase) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Parent must be a showcase card (is_showcase_parent=1)']);
                    return;
                }
            }

            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            if (empty($input['name'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'name is required']);
                return;
            }

            // Copy categories from parent unless explicitly passed
            $categoryIds = null;
            if (isset($input['category_ids']) && is_array($input['category_ids'])) {
                $categoryIds = $input['category_ids'];
            } else {
                try {
                    $cStmt = $pdo->prepare("SELECT category_id FROM product_category WHERE product_id = ?");
                    $cStmt->execute([$parentId]);
                    $categoryIds = array_map(function($r) { return $r['category_id']; }, $cStmt->fetchAll(PDO::FETCH_ASSOC));
                } catch (Exception $e) {
                    $categoryIds = [];
                }
            }

            // Create variant product
            $name = $input['name'];
            $description = $input['description'] ?? '';
            $price = isset($input['price']) ? floatval($input['price']) : 0;
            $sku = $input['sku'] ?? '';
            $weight = $input['weight'] ?? null;
            $calories = $input['calories'] ?? null;

            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare("INSERT INTO products (name, description, price, sku, weight, calories, parent_product_id, visible_on_site) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([$name, $description, $price, $sku, $weight, $calories, $parentId, 1]);
                $newId = $pdo->lastInsertId();

                if (is_array($categoryIds) && !empty($categoryIds)) {
                    $catStmt = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
                    foreach ($categoryIds as $cid) {
                        $catStmt->execute([$newId, $cid]);
                    }
                }

                $pdo->commit();
                $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ?");
                $stmt->execute([$newId]);
                $variant = $stmt->fetch(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'data' => $variant]);
            } catch (Exception $e) {
                $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to create variant', 'message' => $e->getMessage()]);
            }
            return;

        case 'PUT':
            if ($variantId === null) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'variantId is required']);
                return;
            }
            $input = json_decode(file_get_contents('php://input'), true) ?: [];

            $fields = [];
            $params = [];
            $allowed = ['name', 'description', 'price', 'sku', 'weight', 'calories', 'cost', 'stock_quantity', 'vat_rate', 'tax_type', 'type'];
            foreach ($allowed as $k) {
                if (array_key_exists($k, $input)) {
                    $fields[] = "$k = ?";
                    $params[] = $input[$k];
                }
            }
            if (empty($fields)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'No fields to update']);
                return;
            }

            $params[] = $variantId;
            $params[] = $parentId;
            $sql = "UPDATE products SET " . implode(', ', $fields) . " WHERE id = ? AND parent_product_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ? AND parent_product_id = ?");
            $stmt->execute([$variantId, $parentId]);
            $variant = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $variant]);
            return;

        case 'DELETE':
            if ($variantId === null) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'variantId is required']);
                return;
            }
            // Block deletion if variant participates in active orders
            try {
                $variantOrderInfo = countActiveOrdersUsingProduct($pdo, intval($variantId));
                if (($variantOrderInfo['count'] ?? 0) > 0) {
                    http_response_code(409);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Variant is used in active orders',
                        'active_orders_count' => $variantOrderInfo['count'],
                        'active_order_ids' => $variantOrderInfo['order_ids']
                    ]);
                    return;
                }
            } catch (Exception $e) {
                // ignore
            }
            try {
                $pdo->beginTransaction();
                $pdo->prepare("DELETE FROM product_category WHERE product_id = ?")->execute([$variantId]);
                $pdo->prepare("DELETE FROM products WHERE id = ? AND parent_product_id = ?")->execute([$variantId, $parentId]);
                $pdo->commit();
                echo json_encode(['success' => true, 'deleted' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to delete variant', 'message' => $e->getMessage()]);
            }
            return;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
            return;
    }
}

function calculateRecipeAvailablePortions($pdo, $recipeRow, $warehouseId = 2) {
    $warehouseId = intval($warehouseId ?: 2);
    $ingredients = json_decode($recipeRow['ingredients'] ?? '[]', true);
    if (!is_array($ingredients) || empty($ingredients)) return 0;

    $minPortions = null;
    foreach ($ingredients as $ingredient) {
        $ingredientId = $ingredient['product_id'] ?? $ingredient['id'] ?? null;
        $requiredQty = floatval($ingredient['quantity'] ?? $ingredient['qty'] ?? 0);
        $requiredUnit = $ingredient['unit'] ?? 'шт';
        if (!$ingredientId || $requiredQty <= 0) continue;

        $targetType = inferQuantityTypeFromUnit($requiredUnit);
        $requiredBase = convertToTypeQuantity($requiredQty, $requiredUnit, $targetType);
        if ($requiredBase === null || $requiredBase <= 0) continue;

        $currentBase = getProductAvailableBaseQty($pdo, $ingredientId, $warehouseId, $targetType, $requiredUnit);
        $portionsByIng = floor($currentBase / $requiredBase);
        if ($minPortions === null || $portionsByIng < $minPortions) {
            $minPortions = $portionsByIng;
        }
    }
    return max(0, intval($minPortions ?? 0));
}

function calculateRecipeAvailablePortionsWithModifiers($pdo, $recipeRow, $warehouseId = 2, $modifierSelections = []) {
    $warehouseId = intval($warehouseId ?: 2);
    $ingredients = json_decode($recipeRow['ingredients'] ?? '[]', true);
    if (!is_array($ingredients)) $ingredients = [];

    $requirements = [];
    $addRequirement = function($ingredientId, $qty, $unit) use (&$requirements) {
        $iid = intval($ingredientId);
        $q = floatval($qty);
        $u = $unit ?? 'шт';
        if ($iid <= 0 || $q <= 0) return;

        $targetType = inferQuantityTypeFromUnit($u);
        $base = convertToTypeQuantity($q, $u, $targetType);
        if ($base === null || $base <= 0) return;

        if (!isset($requirements[$iid])) {
            $requirements[$iid] = [
                'type' => $targetType,
                'unit' => $u,
                'required_base' => 0.0
            ];
        }
        // do not mix incompatible types
        if (($requirements[$iid]['type'] ?? '') !== $targetType) return;
        $requirements[$iid]['required_base'] += floatval($base);
    };

    foreach ($ingredients as $ingredient) {
        $ingredientId = $ingredient['product_id'] ?? $ingredient['id'] ?? null;
        $requiredQty = floatval($ingredient['quantity'] ?? $ingredient['qty'] ?? 0);
        $requiredUnit = $ingredient['unit'] ?? 'шт';
        $addRequirement($ingredientId, $requiredQty, $requiredUnit);
    }

    if (is_array($modifierSelections) && !empty($modifierSelections)) {
        try {
            ensureModifierIngredientsTable($pdo);
            $rulesStmt = $pdo->prepare("SELECT ingredient_product_id, quantity, unit FROM modifier_ingredients WHERE modifier_id = ? ORDER BY id ASC");
            foreach ($modifierSelections as $sel) {
                if (!is_array($sel)) continue;
                $mid = intval($sel['modifier_id'] ?? $sel['id'] ?? 0);
                $mqty = floatval($sel['qty'] ?? $sel['quantity'] ?? 1);
                if ($mid <= 0 || $mqty <= 0) continue;
                $rulesStmt->execute([$mid]);
                $rules = $rulesStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rules as $rule) {
                    $iid = intval($rule['ingredient_product_id'] ?? 0);
                    $rq = floatval($rule['quantity'] ?? 0) * $mqty;
                    $ru = $rule['unit'] ?? 'шт';
                    $addRequirement($iid, $rq, $ru);
                }
            }
        } catch (Exception $e) {
            // ignore
        }
    }

    if (empty($requirements)) return 0;

    $minPortions = null;
    foreach ($requirements as $iid => $req) {
        $need = floatval($req['required_base'] ?? 0);
        if ($need <= 0) continue;
        $targetType = $req['type'] ?? 'pcs';
        $fallbackUnit = $req['unit'] ?? null;
        $currentBase = getProductAvailableBaseQty($pdo, $iid, $warehouseId, $targetType, $fallbackUnit);
        $portionsByIng = floor($currentBase / $need);
        if ($minPortions === null || $portionsByIng < $minPortions) {
            $minPortions = $portionsByIng;
        }
    }

    return max(0, intval($minPortions ?? 0));
}

function handleInventoryForecast() {
    global $pdo;
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }

    $warehouseId = isset($_GET['warehouse_id']) ? intval($_GET['warehouse_id']) : 2;
    if ($warehouseId <= 0) $warehouseId = 2;

    $modifierSelections = [];
    if (isset($_GET['modifiers']) && is_string($_GET['modifiers'])) {
        $decoded = json_decode($_GET['modifiers'], true);
        if (is_array($decoded)) {
            $modifierSelections = $decoded;
        }
    }

    try {
        $stmt = $pdo->query("SELECT r.id, r.product_id, r.name, r.ingredients, p.name as product_name, p.visible_on_site FROM recipes r INNER JOIN products p ON r.product_id = p.id WHERE r.is_active = 1");
        $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
        $out = [];
        foreach ($rows as $r) {
            $portions = calculateRecipeAvailablePortions($pdo, $r, $warehouseId);
            $portionsWithMods = null;
            if (!empty($modifierSelections)) {
                $portionsWithMods = calculateRecipeAvailablePortionsWithModifiers($pdo, $r, $warehouseId, $modifierSelections);
            }
            $out[] = [
                'recipe_id' => intval($r['id'] ?? 0),
                'product_id' => intval($r['product_id'] ?? 0),
                'name' => $r['product_name'] ?? $r['name'],
                'available_portions' => $portions,
                'available_portions_with_modifiers' => $portionsWithMods,
                'warehouse_id' => $warehouseId,
                'visible_on_site' => isset($r['visible_on_site']) ? intval($r['visible_on_site']) : 1
            ];
        }
        echo json_encode(['ok' => true, 'success' => true, 'data' => $out], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
}

function getRequestHeaderValue($name) {
    $target = strtolower((string)$name);
    foreach ($_SERVER as $k => $v) {
        if (strpos($k, 'HTTP_') !== 0) continue;
        $normalized = strtolower(str_replace('_', '-', substr($k, 5)));
        if ($normalized === $target) {
            return $v;
        }
    }
    return null;
}

function getAdminApiKey($pdo) {
    $envKey = getenv('ADMIN_API_KEY');
    if ($envKey !== false && trim((string)$envKey) !== '') {
        return trim((string)$envKey);
    }
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");
        $stmt = $pdo->prepare("SELECT value FROM settings WHERE key = 'admin_api_key'");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && isset($row['value']) && trim((string)$row['value']) !== '') {
            return trim((string)$row['value']);
        }
    } catch (Exception $e) {
        return null;
    }
    return null;
}

function requireAdminAccessIfConfigured($pdo) {
    $key = getAdminApiKey($pdo);
    if (!$key) {
        return;
    }

    $providedKey = getRequestHeaderValue('x-admin-key');
    if ($providedKey !== null && hash_equals($key, trim((string)$providedKey))) {
        return;
    }

    $auth = getRequestHeaderValue('authorization');
    if ($auth !== null) {
        $auth = trim((string)$auth);
        if (stripos($auth, 'bearer ') === 0) {
            $token = trim(substr($auth, 7));
            if ($token !== '' && hash_equals($key, $token)) {
                return;
            }
        }
    }

    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Forbidden']);
    exit;
}

function extractOrderItemModifierSelections($item) {
    if (!is_array($item)) return [];

    $candidates = [];
    $keys = ['extras', 'modifiers', 'modifierIds', 'modifier_ids', 'selectedModifiers', 'selected_modifiers', 'options', 'selectedOptions', 'selected_options', 'addons', 'toppings'];
    foreach ($keys as $key) {
        if (!isset($item[$key])) continue;
        $val = $item[$key];
        if (is_string($val)) {
            $decoded = json_decode($val, true);
            if (is_array($decoded)) $val = $decoded;
        }
        if (is_array($val)) {
            $candidates = array_merge($candidates, $val);
        }
    }

    // варианты, когда modifiers - это массив id
    $result = [];
    foreach ($candidates as $entry) {
        if (is_numeric($entry)) {
            $result[] = ['modifier_id' => intval($entry), 'qty' => 1];
            continue;
        }
        if (is_string($entry)) {
            $codeOrName = trim($entry);
            if ($codeOrName !== '') {
                $result[] = ['modifier_id' => 0, 'modifier_code' => $codeOrName, 'modifier_name' => $codeOrName, 'qty' => 1];
            }
            continue;
        }
        if (!is_array($entry)) continue;

        $modifierId = intval($entry['modifier_id'] ?? $entry['modifierId'] ?? $entry['id'] ?? $entry['option_id'] ?? $entry['optionId'] ?? 0);
        $modifierName = trim((string)($entry['name'] ?? $entry['option_name'] ?? $entry['optionName'] ?? ''));
        $modifierCode = trim((string)($entry['code'] ?? $entry['option_code'] ?? $entry['optionCode'] ?? ''));
        if ($modifierId <= 0 && $modifierName === '' && $modifierCode === '') continue;

        // Если элемент содержит boolean selected/default_on — учитываем
        $selected = $entry['selected'] ?? $entry['is_selected'] ?? $entry['default_on'] ?? true;
        if ($selected === false || $selected === 0 || $selected === '0') {
            continue;
        }
        $qty = floatval($entry['qty'] ?? $entry['quantity'] ?? $entry['count'] ?? 1);
        if ($qty <= 0) $qty = 1;

        $result[] = ['modifier_id' => $modifierId, 'modifier_code' => $modifierCode, 'modifier_name' => $modifierName, 'qty' => $qty];
    }

    // Убираем дубли (суммируем qty)
    $merged = [];
    foreach ($result as $row) {
        $mid = intval($row['modifier_id']);
        if ($mid <= 0) continue;
        if (!isset($merged[$mid])) {
            $merged[$mid] = 0;
        }
        $merged[$mid] += floatval($row['qty'] ?? 1);
    }
    $out = [];
    foreach ($merged as $mid => $qty) {
        $out[] = ['modifier_id' => intval($mid), 'qty' => $qty];
    }

    // Добавляем те, что пришли без id (name/code)
    foreach ($result as $row) {
        $mid = intval($row['modifier_id'] ?? 0);
        if ($mid > 0) continue;
        $name = trim((string)($row['modifier_name'] ?? ''));
        $code = trim((string)($row['modifier_code'] ?? ''));
        $qty = floatval($row['qty'] ?? 1);
        if ($qty <= 0) $qty = 1;
        if ($name === '' && $code === '') continue;
        $out[] = ['modifier_id' => 0, 'modifier_name' => $name ?: $code, 'modifier_code' => $code ?: $name, 'qty' => $qty];
    }

    return $out;
}

function resolveModifierIdForSelection($pdo, $selection) {
    static $cache = [];
    if (!is_array($selection)) return 0;
    $mid = intval($selection['modifier_id'] ?? 0);
    if ($mid > 0) return $mid;

    $code = trim((string)($selection['modifier_code'] ?? ''));
    $name = trim((string)($selection['modifier_name'] ?? ''));

    $mapLegacy = [
        'cheese' => 'Сырный бортик',
        'pepperoni' => 'Пряная говядина',
        'mushrooms' => 'Моцарелла',
        'jalapeno' => 'Халапеньо'
    ];
    if ($code !== '' && isset($mapLegacy[$code]) && $name === $code) {
        $name = $mapLegacy[$code];
    }

    $key = ($code !== '' ? ('c:' . mb_strtolower($code)) : '') . '|' . ($name !== '' ? ('n:' . mb_strtolower($name)) : '');
    if (isset($cache[$key])) {
        return intval($cache[$key]);
    }

    try {
        ensureItemOptionsTable($pdo);
        $stmt = $pdo->prepare("SELECT id FROM item_options WHERE option_code = ? LIMIT 1");
        if ($code !== '') {
            $stmt->execute([$code]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && isset($row['id'])) {
                $cache[$key] = intval($row['id']);
                return intval($row['id']);
            }
        }

        $stmt2 = $pdo->prepare("SELECT id FROM item_options WHERE option_name = ? LIMIT 1");
        if ($name !== '') {
            $stmt2->execute([$name]);
            $row2 = $stmt2->fetch(PDO::FETCH_ASSOC);
            if ($row2 && isset($row2['id'])) {
                $cache[$key] = intval($row2['id']);
                return intval($row2['id']);
            }
        }
    } catch (Exception $e) {
        // ignore
    }

    $cache[$key] = 0;
    return 0;
}

function ensureModifierIngredientsTable($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS modifier_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        modifier_id INTEGER NOT NULL,
        ingredient_product_id INTEGER NOT NULL,
        quantity DECIMAL(10,3) NOT NULL,
        unit TEXT DEFAULT 'шт',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_modifier_ingredients_modifier ON modifier_ingredients(modifier_id)");
}

function handleModifierIngredients($pdo, $modifierId) {
    $method = $_SERVER['REQUEST_METHOD'];
    $modifierId = intval($modifierId);
    if ($modifierId <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid modifier id']);
        return;
    }

    ensureModifierIngredientsTable($pdo);

    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT ingredient_product_id, quantity, unit FROM modifier_ingredients WHERE modifier_id = ? ORDER BY id ASC");
        $stmt->execute([$modifierId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['ok' => true, 'modifier_id' => $modifierId, 'ingredients' => $rows], JSON_UNESCAPED_UNICODE);
        return;
    }

    if ($method === 'POST' || $method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $ingredients = $input['ingredients'] ?? $input;
        if (!is_array($ingredients)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Invalid payload']);
            return;
        }

        $pdo->beginTransaction();
        try {
            $del = $pdo->prepare("DELETE FROM modifier_ingredients WHERE modifier_id = ?");
            $del->execute([$modifierId]);
            $ins = $pdo->prepare("INSERT INTO modifier_ingredients (modifier_id, ingredient_product_id, quantity, unit) VALUES (?, ?, ?, ?)");
            foreach ($ingredients as $row) {
                if (!is_array($row)) continue;
                $pid = intval($row['ingredient_product_id'] ?? $row['product_id'] ?? $row['productId'] ?? $row['id'] ?? 0);
                $qty = floatval($row['quantity'] ?? $row['qty'] ?? 0);
                $unit = $row['unit'] ?? $row['unitName'] ?? 'шт';
                if ($pid <= 0 || $qty <= 0) continue;
                $ins->execute([$modifierId, $pid, $qty, $unit]);
            }
            $pdo->commit();
            echo json_encode(['ok' => true, 'modifier_id' => $modifierId], JSON_UNESCAPED_UNICODE);
            return;
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
            return;
        }
    }

    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Глобальная обработка ошибок
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal error',
        'message' => $errstr,
        'file' => basename($errfile),
        'line' => $errline
    ]);
    exit();
});

// Глобальная обработка исключений
set_exception_handler(function($e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Exception',
        'message' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ]);
    exit();
});

// Simple routing (path уже определен выше)

// Логирование для отладки
error_log("API Request: METHOD=" . $_SERVER['REQUEST_METHOD'] . ", URI=" . $request_uri . ", PATH=" . $path . ", Full URI=" . $_SERVER['REQUEST_URI']);

// Database connection (SQLite)
$db_path = __DIR__ . '/database.sqlite';
$db_exists = file_exists($db_path);

// Проверяем наличие PDO SQLite
if (!extension_loaded('pdo_sqlite')) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'PDO SQLite extension is not installed',
        'message' => 'Please contact your hosting provider to enable PDO SQLite extension'
    ]);
    exit();
}

try {
    // Убеждаемся, что директория существует и доступна для записи
    $db_dir = dirname($db_path);
    if (!is_dir($db_dir)) {
        @mkdir($db_dir, 0755, true);
    }
    
    // Проверяем права на запись в директорию
    if (!is_writable($db_dir)) {
        @chmod($db_dir, 0755);
    }
    
    $pdo = new PDO("sqlite:$db_path");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA foreign_keys = ON');
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed',
        'message' => $e->getMessage(),
        'db_path' => $db_path
    ]);
    exit();
}

// Initialize database if it was just created
if (!$db_exists) {
    initializeDatabase($pdo);
} else {
    // Check if orders table exists (in case DB is corrupted)
    try {
        $pdo->query("SELECT 1 FROM orders LIMIT 1");
    } catch (Exception $e) {
        // Table doesn't exist, reinitialize
        initializeDatabase($pdo);
    }
    
    // Проверяем и создаем таблицу categories, если её нет
    try {
        $tableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'");
        if ($tableCheck->fetchColumn() === false) {
            // Таблица categories не существует - создаем её
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    parent_id INTEGER,
                    name TEXT NOT NULL,
                    slug TEXT UNIQUE,
                    description TEXT,
                    image_url TEXT,
                    seo_title TEXT,
                    seo_description TEXT,
                    seo_keywords TEXT,
                    position INTEGER DEFAULT 0,
                    show_on_site BOOLEAN DEFAULT 1,
                    show_in_nav BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
                )
            ");
            error_log("Created categories table (was missing)");
        }
    } catch (Exception $e) {
        error_log("Error checking/creating categories table: " . $e->getMessage());
    }
}

function csvEscapeCell($value) {
    if ($value === null) return '';
    if (is_bool($value)) $value = $value ? '1' : '0';
    $str = (string)$value;
    $str = str_replace("\r", ' ', $str);
    $str = str_replace("\n", ' ', $str);
    $str = str_replace('"', '""', $str);
    return '"' . $str . '"';
}

function csvRender(array $rows) {
    $lines = [];
    foreach ($rows as $row) {
        $cells = [];
        foreach ($row as $cell) {
            $cells[] = csvEscapeCell($cell);
        }
        $lines[] = implode(',', $cells);
    }
    return implode("\n", $lines);
}

function csvSendDownload($filename, array $rows) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    echo "\xEF\xBB\xBF";
    echo csvRender($rows);
    exit;
}

function parseDateFilterParam($value) {
    $v = trim((string)$value);
    if ($v === '') return null;
    $ts = strtotime($v);
    if ($ts === false) return null;
    return date('Y-m-d', $ts);
}

function handleDiadocExportInvoicesCsv($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }

    requireAdminAccessIfConfigured($pdo);

    ensureDiadocInvoiceTables($pdo);
    $from = isset($_GET['from']) ? parseDateFilterParam($_GET['from']) : null;
    $to = isset($_GET['to']) ? parseDateFilterParam($_GET['to']) : null;

    $where = [];
    $params = [];
    if ($from) {
        $where[] = "date(doc_date) >= date(?)";
        $params[] = $from;
    }
    if ($to) {
        $where[] = "date(doc_date) <= date(?)";
        $params[] = $to;
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $sql = "SELECT id, source, source_filename, doc_number, doc_date, supplier_name, supplier_inn, supplier_kpp, buyer_name, buyer_inn, buyer_kpp, total, currency, is_paid, receipt_document_id, created_at
            FROM invoice_documents
            $whereSql
            ORDER BY id DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $docs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $rows = [];
    $rows[] = ['invoice_id', 'source', 'source_filename', 'doc_number', 'doc_date', 'supplier_name', 'supplier_inn', 'supplier_kpp', 'buyer_name', 'buyer_inn', 'buyer_kpp', 'total', 'currency', 'is_paid', 'receipt_document_id', 'created_at'];
    foreach ($docs as $d) {
        $rows[] = [
            $d['id'] ?? '',
            $d['source'] ?? '',
            $d['source_filename'] ?? '',
            $d['doc_number'] ?? '',
            $d['doc_date'] ?? '',
            $d['supplier_name'] ?? '',
            $d['supplier_inn'] ?? '',
            $d['supplier_kpp'] ?? '',
            $d['buyer_name'] ?? '',
            $d['buyer_inn'] ?? '',
            $d['buyer_kpp'] ?? '',
            $d['total'] ?? '',
            $d['currency'] ?? '',
            $d['is_paid'] ?? 0,
            $d['receipt_document_id'] ?? '',
            $d['created_at'] ?? ''
        ];
    }

    $fn = 'diadoc_invoices_' . date('Y-m-d') . '.csv';
    csvSendDownload($fn, $rows);
}

function handleDiadocExportInvoiceLinesCsv($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }

    requireAdminAccessIfConfigured($pdo);

    ensureDiadocInvoiceTables($pdo);
    $from = isset($_GET['from']) ? parseDateFilterParam($_GET['from']) : null;
    $to = isset($_GET['to']) ? parseDateFilterParam($_GET['to']) : null;

    $where = [];
    $params = [];
    if ($from) {
        $where[] = "date(d.doc_date) >= date(?)";
        $params[] = $from;
    }
    if ($to) {
        $where[] = "date(d.doc_date) <= date(?)";
        $params[] = $to;
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $sql = "SELECT
                l.id as line_id,
                l.invoice_document_id,
                d.doc_number,
                d.doc_date,
                d.supplier_name,
                l.line_index,
                l.name,
                l.sku_external,
                l.gtin,
                l.unit,
                l.quantity_purchase,
                l.purchase_price,
                l.vat_rate,
                l.total_with_vat,
                l.account_code,
                l.category_name,
                l.sku_internal,
                l.unit_coeff,
                l.matched_product_id,
                l.match_score
            FROM invoice_lines l
            INNER JOIN invoice_documents d ON d.id = l.invoice_document_id
            $whereSql
            ORDER BY l.invoice_document_id DESC, l.line_index ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $lines = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $rows = [];
    $rows[] = ['line_id', 'invoice_document_id', 'doc_number', 'doc_date', 'supplier_name', 'line_index', 'name', 'sku_external', 'gtin', 'unit', 'quantity_purchase', 'purchase_price', 'vat_rate', 'total_with_vat', 'account_code', 'category_name', 'sku_internal', 'unit_coeff', 'matched_product_id', 'match_score'];
    foreach ($lines as $l) {
        $rows[] = [
            $l['line_id'] ?? '',
            $l['invoice_document_id'] ?? '',
            $l['doc_number'] ?? '',
            $l['doc_date'] ?? '',
            $l['supplier_name'] ?? '',
            $l['line_index'] ?? '',
            $l['name'] ?? '',
            $l['sku_external'] ?? '',
            $l['gtin'] ?? '',
            $l['unit'] ?? '',
            $l['quantity_purchase'] ?? '',
            $l['purchase_price'] ?? '',
            $l['vat_rate'] ?? '',
            $l['total_with_vat'] ?? '',
            $l['account_code'] ?? '',
            $l['category_name'] ?? '',
            $l['sku_internal'] ?? '',
            $l['unit_coeff'] ?? '',
            $l['matched_product_id'] ?? '',
            $l['match_score'] ?? ''
        ];
    }

    $fn = 'diadoc_invoice_lines_' . date('Y-m-d') . '.csv';
    csvSendDownload($fn, $rows);
}

function handleInventoryExportBalancesCsv($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }

    requireAdminAccessIfConfigured($pdo);

    ensureInventoryBalancesTable($pdo);
    $warehouseId = isset($_GET['warehouseId']) ? intval($_GET['warehouseId']) : null;
    $from = isset($_GET['from']) ? parseDateFilterParam($_GET['from']) : null;
    $to = isset($_GET['to']) ? parseDateFilterParam($_GET['to']) : null;

    $where = [];
    $params = [];
    if ($warehouseId) {
        $where[] = 'warehouse_id = ?';
        $params[] = $warehouseId;
    }
    if ($from) {
        $where[] = "date(created_at) >= date(?)";
        $params[] = $from;
    }
    if ($to) {
        $where[] = "date(created_at) <= date(?)";
        $params[] = $to;
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $sql = "SELECT id, product_id, warehouse_id, quantity, unit, purchase_price, vat_rate, batch_number, expiry_date, created_at, updated_at
            FROM inventory_balances
            $whereSql
            ORDER BY warehouse_id, product_id, created_at";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rowsDb = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $rows = [];
    $rows[] = ['balance_id', 'product_id', 'warehouse_id', 'quantity', 'unit', 'purchase_price', 'vat_rate', 'batch_number', 'expiry_date', 'created_at', 'updated_at'];
    foreach ($rowsDb as $b) {
        $rows[] = [
            $b['id'] ?? '',
            $b['product_id'] ?? '',
            $b['warehouse_id'] ?? '',
            $b['quantity'] ?? '',
            $b['unit'] ?? '',
            $b['purchase_price'] ?? '',
            $b['vat_rate'] ?? '',
            $b['batch_number'] ?? '',
            $b['expiry_date'] ?? '',
            $b['created_at'] ?? '',
            $b['updated_at'] ?? ''
        ];
    }

    $fn = 'inventory_balances_' . date('Y-m-d') . '.csv';
    csvSendDownload($fn, $rows);
}

function handleInventoryExportReceiptsCsv($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }

    requireAdminAccessIfConfigured($pdo);

    $warehouseId = isset($_GET['warehouseId']) ? intval($_GET['warehouseId']) : null;
    $from = isset($_GET['from']) ? parseDateFilterParam($_GET['from']) : null;
    $to = isset($_GET['to']) ? parseDateFilterParam($_GET['to']) : null;

    $docs = getInventoryDocuments();
    $rows = [];
    $rows[] = ['receipt_document_id', 'doc_number', 'doc_date', 'status', 'warehouse_id', 'product_id', 'name', 'qty', 'unit', 'purchase_price', 'account_code', 'invoice_document_id'];

    foreach ($docs as $doc) {
        $type = $doc['docType'] ?? $doc['type'] ?? null;
        if ($type !== 'receipt') continue;
        $wh = intval($doc['warehouseId'] ?? $doc['warehouse'] ?? 0);
        if ($warehouseId && $wh !== $warehouseId) continue;

        $dateVal = $doc['docDate'] ?? $doc['date'] ?? null;
        $dateNorm = $dateVal ? parseDateFilterParam($dateVal) : null;
        if ($from && $dateNorm && $dateNorm < $from) continue;
        if ($to && $dateNorm && $dateNorm > $to) continue;

        $lines = $doc['lines'] ?? $doc['items'] ?? [];
        if (!is_array($lines)) $lines = [];

        foreach ($lines as $ln) {
            $rows[] = [
                $doc['id'] ?? '',
                $doc['docNumber'] ?? ($doc['number'] ?? ''),
                $dateVal ?? '',
                $doc['status'] ?? '',
                $wh ?: '',
                $ln['productId'] ?? ($ln['product_id'] ?? ''),
                $ln['name'] ?? '',
                $ln['qty'] ?? ($ln['quantity'] ?? ''),
                $ln['unit'] ?? '',
                $ln['purchasePrice'] ?? ($ln['purchase_price'] ?? ''),
                $ln['accountCode'] ?? ($ln['account_code'] ?? ''),
                $ln['invoice_document_id'] ?? ($doc['invoice_document_id'] ?? '')
            ];
        }
    }

    $fn = 'inventory_receipts_' . date('Y-m-d') . '.csv';
    csvSendDownload($fn, $rows);
}

ensureProductCategoryTable($pdo);
ensureMenuSectionsTable($pdo);
ensureItemsTable($pdo);
ensureItemOptionsTable($pdo);
ensureCategoriesSchema($pdo);
ensureDiadocInvoiceTables($pdo);

// Всегда запускаем миграции для обновления структуры таблиц
runMigrations($pdo);

// Handle dynamic routes like /orders/123/status
if (preg_match('/^orders\/(\d+)\/status$/', $path, $matches)) {
    handleOrderStatus($pdo, $matches[1]);
} elseif (preg_match('/^orders\/(\d+)\/address$/', $path, $matches)) {
    handleOrderAddress($pdo, $matches[1]);
} elseif (preg_match('/^orders\/(\d+)$/', $path, $matches)) {
    handleSingleOrder($pdo, $matches[1]);
} elseif (preg_match('/^catalog\/health$/', $path)) {
    echo json_encode(['success' => true, 'data' => ['status' => 'ok', 'timestamp' => date('c')]]);
    exit;
} elseif (preg_match('/^catalog\/modifiers$/', $path)) {
    try {
        ensureItemOptionsTable($pdo);
        $stmt = $pdo->query("SELECT * FROM item_options ORDER BY group_name, sort_order, id");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as &$r) {
            if (isset($r['is_visible'])) {
                $r['is_visible'] = (bool)$r['is_visible'];
            }
            if (isset($r['show_in_product_card'])) {
                $r['show_in_product_card'] = (bool)$r['show_in_product_card'];
            }
            if (!empty($r['image_url'])) {
                $imgUrl = trim($r['image_url']);
                $imgUrl = str_replace('\\\\', '/', $imgUrl);
                if (!preg_match('/^https?:\\/\\//', $imgUrl) && !str_starts_with($imgUrl, '/')) {
                    $imgUrl = '/' . $imgUrl;
                }
                if (str_starts_with($imgUrl, 'storage/')) {
                    $imgUrl = '/' . $imgUrl;
                }
                $r['image_url'] = $imgUrl;
            }
        }
        unset($r);

        $groupMap = [];
        foreach ($rows as $m) {
            $gid = $m['group_code'] ?? $m['group_name'] ?? 'default';
            $gname = $m['group_name'] ?? '';
            if (!isset($groupMap[$gid])) {
                $groupMap[$gid] = [
                    'group_id' => $gid,
                    'group_code' => $m['group_code'] ?? null,
                    'group_name' => $gname,
                    'multi_select' => null,
                    'min_select' => null,
                    'max_select' => null,
                    'options' => []
                ];
            }
            $groupMap[$gid]['options'][] = [
                'id' => $m['id'] ?? null,
                'name' => $m['option_name'] ?? '',
                'price' => $m['price_value'] ?? 0,
                'image_url' => $m['image_url'] ?? '',
                'type' => $m['type'] ?? 'checkbox',
                'is_visible' => $m['is_visible'] ?? true,
                'show_in_product_card' => $m['show_in_product_card'] ?? true,
                'max_qty' => $m['max_qty'] ?? null,
                'default_on' => $m['default_on'] ?? 0,
                'item_id' => $m['item_id'] ?? null
            ];
        }

        echo json_encode(['success' => true, 'data' => array_values($groupMap)]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit;
    }
} elseif (preg_match('/^storefront\/categories$/', $path)) {
    handleStorefrontCategories($pdo);
} elseif (preg_match('/^storefront\/items\/(\d+)$/', $path, $matches)) {
    handleStorefrontItemById($pdo, $matches[1]);
} elseif (preg_match('/^storefront\/items$/', $path)) {
    handleStorefrontItems($pdo);
} elseif (preg_match('/^import\/yml$/', $path)) {
    handleImportYml($pdo);
} elseif (preg_match('/^import\/preview$/', $path)) {
    handleImportYmlPreview($pdo);
} elseif (preg_match('/^import\/confirm$/', $path)) {
    handleImportYmlConfirm($pdo);
} elseif (preg_match('/^import\/history$/', $path)) {
    handleImportYmlHistory($pdo);
} elseif (preg_match('/^v1\/projects\/(\d+)$/', $path, $matches)) {
    handleSingleProject($pdo, $matches[1]);
} elseif (preg_match('/^v1\/projects/', $path)) {
    handleProjects($pdo);
} elseif (preg_match('/^v1\/recipes/', $path)) {
    handleRecipes($pdo);
} elseif (preg_match('/^v1\/items\/variant\/(\d+)$/', $path, $matches)) {
    handleItemVariant($pdo, $matches[1]);
} elseif (preg_match('/^v1\/items\/(\d+)\/variants$/', $path, $matches)) {
    handleItemVariants($pdo, $matches[1]);
} elseif (preg_match('/^v1\/items\/(\d+)\/options$/', $path, $matches)) {
    handleItemOptions($pdo, $matches[1]);
} elseif (preg_match('/^v1\/items\/(\d+)$/', $path, $matches)) {
    handleSingleItem($pdo, $matches[1]);
} elseif (preg_match('/^v1\/items/', $path)) {
    handleItems($pdo);
} elseif (preg_match('/^v1\/products/', $path)) {
    handleProducts($pdo);
} elseif (preg_match('/^v1\/categories/', $path)) {
    handleCategories($pdo);
} elseif (preg_match('/^items\/(\d+)\/variants$/', $path, $matches)) {
    handleProductVariants($pdo, $matches[1], null);
} elseif (preg_match('/^items\/(\d+)\/modifiers\/(\d+)$/', $path, $matches)) {
    handleItemModifiers($pdo, $matches[1], $matches[2]);
} elseif (preg_match('/^items\/(\d+)\/modifiers$/', $path, $matches)) {
    handleItemModifiers($pdo, $matches[1], null);
} elseif (preg_match('/^items\/(\d+)$/', $path, $matches)) {
    handleSingleProduct($pdo, $matches[1]);
} elseif (preg_match('/^items$/', $path)) {
    handleProducts($pdo);
} elseif (preg_match('/^product-groups\/(\d+)$/', $path, $matches)) {
    handleSingleProductGroup($pdo, $matches[1]);
} elseif (preg_match('/^product-groups/', $path)) {
    handleProductGroups($pdo);
} elseif (preg_match('/^promotions\/check$/', $path)) {
    handlePromotionsCheck($pdo);
} elseif (preg_match('/^promotions\/eligible$/', $path)) {
    handleEligiblePromotions($pdo);
} elseif (preg_match('/^promotions\/(\d+)$/', $path, $matches)) {
    // Handle /promotions/{id} for DELETE - перенаправляем на новый API
    handlePromotionById($pdo, $matches[1]);
} elseif (preg_match('/^promotions/', $path)) {
    handlePromotions($pdo);
} elseif (preg_match('/^loyalty\/config$/', $path)) {
    handleLoyaltyConfig($pdo);
} elseif (preg_match('/^loyalty\/stats/', $path)) {
    handleLoyaltyStats($pdo);
} elseif (preg_match('/^diadoc\/import\/preview$/', $path)) {
    handleDiadocImportPreview($pdo);
} elseif (preg_match('/^diadoc\/import\/apply$/', $path)) {
    handleDiadocImportApply($pdo);
} elseif (preg_match('/^diadoc\/export\/invoices\.csv$/', $path)) {
    handleDiadocExportInvoicesCsv($pdo);
} elseif (preg_match('/^diadoc\/export\/invoice-lines\.csv$/', $path)) {
    handleDiadocExportInvoiceLinesCsv($pdo);
} elseif (preg_match('/^inventory\/export\/balances\.csv$/', $path)) {
    handleInventoryExportBalancesCsv($pdo);
} elseif (preg_match('/^inventory\/export\/receipts\.csv$/', $path)) {
    handleInventoryExportReceiptsCsv($pdo);
} elseif (preg_match('/^inventory\/receive$/', $path)) {
    handleInventoryReceive($pdo);
} elseif (preg_match('/^inventory\/writeoff$/', $path)) {
    handleInventoryWriteoff($pdo);
} elseif (preg_match('/^inventory\/warehouses/', $path)) {
    handleWarehouses($pdo);
} elseif (preg_match('/^inventory\/items/', $path)) {
    handleInventoryItems($pdo);
} elseif (preg_match('/^inventory\/expiring/', $path)) {
    handleExpiringItems($pdo);
} elseif (preg_match('/^inventory\/importStock$/', $path)) {
    handleImportStock($pdo);
} elseif (preg_match('/^importImages$/', $path)) {
    handleImportImages($pdo);
} elseif (preg_match('/^onec\/account-rules\/(\d+)$/', $path, $matches)) {
    handleSingleAccountRule($pdo, $matches[1]);
} elseif (preg_match('/^onec\/account-rules/', $path)) {
    handleAccountRules($pdo);
} elseif (preg_match('/^onec\/apply-account-rules$/', $path)) {
    handleApplyAccountRules($pdo);
} elseif (preg_match('/^onec\/import$/', $path)) {
    handleOneCImport($pdo);
} elseif (preg_match('/^onec\/export$/', $path)) {
    handleOneCExport($pdo);
} elseif (preg_match('/^fix-data-issues$/', $path)) {
    handleFixDataIssues($pdo);
} elseif (preg_match('/^sync-products-from-synced$/', $path)) {
    handleSyncProductsFromSynced($pdo);
} elseif (preg_match('/^modifiers\/upload$/', $path)) {
    // ✅ Добавлено: Обработка загрузки изображений модификаторов
    handleModifierImageUpload($pdo);
} elseif (preg_match('/^modifiers\/(\d+)\/ingredients$/', $path, $matches)) {
    handleModifierIngredients($pdo, $matches[1]);
} elseif (preg_match('/^modifiers\/(\d+)$/', $path, $matches)) {
    handleSingleModifier($pdo, $matches[1]);
} elseif (preg_match('/^modifiers/', $path)) {
    handleModifiers($pdo);
} elseif (preg_match('/^importModifiers$/', $path)) {
    handleImportModifiers($pdo);
} elseif (preg_match('/^import\/(modifiers|units|prices|nutrition)$/', $path, $matches)) {
    handleSpecialImport($pdo, $matches[1]);
} elseif (preg_match('/^cashier-report\/shift\/current/', $path)) {
    handleCurrentShift($pdo);
} elseif (preg_match('/^cashier-report\/shift\/open$/', $path)) {
    handleOpenShift($pdo);
} elseif (preg_match('/^cashier-report\/shift\/close$/', $path)) {
    handleCloseShift($pdo);
} elseif (preg_match('/^couriers/', $path)) {
    handleCouriers($pdo);
} elseif (preg_match('/^couriers\/deliveries/', $path)) {
    handleCourierDeliveries($pdo);
} elseif (preg_match('/^mercury\/batches/', $path)) {
    handleMercuryBatches($pdo);
} elseif (preg_match('/^mercury\/documents/', $path)) {
    handleMercuryDocuments($pdo);
} elseif (preg_match('/^edo\/config$/', $path)) {
    handleEDOConfig($pdo);
} elseif (preg_match('/^edo\/inventory\/products/', $path)) {
    handleEDOInventory($pdo);
} elseif (preg_match('/^edo\/documents\/([^\/]+)\/sync$/', $path, $matches)) {
    handleEDODocumentSync($pdo, $matches[1]);
} elseif (preg_match('/^edo\/documents\/([^\/]+)\/sign$/', $path, $matches)) {
    handleEDODocumentSign($pdo, $matches[1]);
} elseif (preg_match('/^edo\/documents\/([^\/]+)\/send$/', $path, $matches)) {
    handleEDODocumentSend($pdo, $matches[1]);
} elseif (preg_match('/^edo\/documents\/([^\/]+)\/reject$/', $path, $matches)) {
    handleEDODocumentReject($pdo, $matches[1]);
} elseif (preg_match('/^edo\/documents\/([^\/]+)\/parse$/', $path, $matches)) {
    handleEDODocumentParse($pdo, $matches[1]);
} elseif (preg_match('/^edo\/documents\/([^\/]+)\/lines$/', $path, $matches)) {
    handleEDODocumentLines($pdo, $matches[1]);
} elseif (preg_match('/^edo\/documents\/([^\/]+)\/matches\/auto$/', $path, $matches)) {
    handleEDODocumentAutoMatch($pdo, $matches[1]);
} elseif (preg_match('/^edo\/documents\/([^\/]+)\/lines\/(\d+)\/match$/', $path, $matches)) {
    handleEDODocumentLineMatch($pdo, $matches[1], $matches[2]);
} elseif (preg_match('/^edo\/documents\/([^\/]+)\/status$/', $path, $matches)) {
    handleEDODocumentStatus($pdo, $matches[1]);
} elseif (preg_match('/^edo\/receipts$/', $path)) {
    handleEDOReceipts($pdo);
} elseif (preg_match('/^edo\/documents/', $path)) {
    handleEDODocuments($pdo);
} elseif (preg_match('/^products\/sync$/', $path)) {
    handleProductsSync($pdo);
} elseif (preg_match('/^products\/export\/yml$/', $path)) {
    handleExportYML($pdo);
} elseif (preg_match('/^categories\/(\d+)\/products$/', $path, $matches)) {
    // Handle /categories/{id}/products - GET products in category
    handleCategoryProducts($pdo, $matches[1]);
} elseif (preg_match('/^products\/(\d+)\/categories$/', $path, $matches)) {
    // Handle /products/{id}/categories - POST/DELETE product categories
    handleProductCategories($pdo, $matches[1]);
} elseif (preg_match('/^categories\/reorder$/', $path)) {
    // Handle /categories/reorder - POST bulk reorder
    handleCategoriesReorder($pdo);
} elseif (preg_match('/^categories\/bulk$/', $path)) {
    // Handle /categories/bulk - POST bulk operations
    handleCategoriesBulk($pdo);
} elseif (preg_match('/^products\/bulk\/categories$/', $path)) {
    // Handle /products/bulk/categories - POST bulk category operations for products
    handleProductsBulkCategories($pdo);
} elseif (preg_match('/^categories\/restore$/', $path)) {
    // Handle /categories/restore - POST restore default categories
    handleCategoriesRestore($pdo);
} elseif (preg_match('/^products\/(\d+)\/variants\/(\d+)$/', $path, $matches)) {
    // Handle /products/{parentId}/variants/{variantId}
    handleProductVariants($pdo, $matches[1], $matches[2]);
} elseif (preg_match('/^products\/(\d+)\/variants$/', $path, $matches)) {
    // Handle /products/{parentId}/variants
    handleProductVariants($pdo, $matches[1], null);
} elseif (preg_match('/^categories\/(.+)$/', $path, $matches)) {
    // Handle /categories/{id} for DELETE and PUT
    handleSingleCategory($pdo, $matches[1]);
} elseif (preg_match('/^products\/(.+)$/', $path, $matches)) {
    // Handle /products/{id} for DELETE and PUT
    error_log("Matched products/{id} route, ID: " . $matches[1]);
    handleSingleProduct($pdo, $matches[1]);
} elseif (preg_match('/^admin-state\/health$/', $path)) {
    // Handle /admin-state/health
    handleAdminStateHealth();
} elseif (preg_match('/^admin-state\/bootstrap$/', $path)) {
    // Handle /admin-state/bootstrap
    handleAdminStateBootstrap();
} elseif (preg_match('/^admin-state\/keys\/(.+)$/', $path, $matches)) {
    // Handle /admin-state/keys/:key
    handleAdminStateKey($matches[1]);
} elseif (preg_match('/^inventory\/bootstrap$/', $path)) {
    // Handle /inventory/bootstrap
    handleInventoryBootstrap();
} elseif (preg_match('/^inventory\/products$/', $path)) {
    // Handle /inventory/products
    handleInventoryProducts();
} elseif (preg_match('/^inventory\/products\/(.+)$/', $path, $matches)) {
    // Handle /inventory/products/:id
    handleInventoryProduct($matches[1]);
} elseif (preg_match('/^inventory\/state\/(.+)$/', $path, $matches)) {
    // Handle /inventory/state/:key
    handleInventoryStateKey($matches[1]);
} elseif (preg_match('/^inventory\/menu\/publish$/', $path)) {
    // Handle /inventory/menu/publish
    handleInventoryMenuPublish();
} elseif (preg_match('/^inventory\/recipes$/', $path)) {
    // Handle /inventory/recipes
    handleInventoryRecipes();
} elseif (preg_match('/^inventory\/recipes\/(.+)$/', $path, $matches)) {
    // Handle /inventory/recipes/:id
    handleInventoryRecipe($matches[1]);
} elseif (preg_match('/^techcards\/components$/', $path)) {
    // Handle /techcards/components
    handleTechcardsComponents($pdo);
} elseif (preg_match('/^inventory\/forecast$/', $path)) {
    handleInventoryForecast();
} elseif (preg_match('/^inventory\/documents$/', $path)) {
    // Handle /inventory/documents
    handleInventoryDocuments();
} elseif (preg_match('/^inventory\/documents\/(.+)$/', $path, $matches)) {
    // Handle /inventory/documents/:id
    handleInventoryDocument($matches[1]);
} elseif (preg_match('/^inventory\/warehouses$/', $path)) {
    // Handle /inventory/warehouses
    handleInventoryWarehouses();
} elseif (preg_match('/^inventory\/warehouses\/(.+)$/', $path, $matches)) {
    // Handle /inventory/warehouses/:id
    handleInventoryWarehouse($matches[1]);
} elseif (preg_match('/^inventory\/movements$/', $path)) {
    // Handle /inventory/movements
    handleInventoryMovements();
} elseif (preg_match('/^inventory\/stock-balances$/', $path)) {
    // Handle /inventory/stock-balances
    handleInventoryStockBalances();
} elseif (preg_match('/^inventory\/virtual-stock$/', $path)) {
    // Handle /inventory/virtual-stock
    handleInventoryVirtualStock();
} elseif (preg_match('/^inventory\/audit$/', $path)) {
    // Handle /inventory/audit
    handleInventoryAudit();
} elseif (preg_match('/^inventory\/sync\/trigger$/', $path)) {
    // Handle /inventory/sync/trigger
    handleInventorySyncTrigger();
} elseif (preg_match('/^inventory\/sync\/status$/', $path)) {
    // Handle /inventory/sync/status
    handleInventorySyncStatus();
} elseif (preg_match('/^inventory\/events$/', $path)) {
    // Handle /inventory/events
    handleInventoryEvents();
} elseif (preg_match('/^honest\/(.+)$/', $path, $matches)) {
    // Handle /honest/:endpoint
    handleHonestSign($matches[1]);
} elseif (preg_match('/^egais\/(.+)$/', $path, $matches)) {
    // Handle /egais/:endpoint
    handleEgais($matches[1]);
} elseif (preg_match('/^aggregators(?:\/(.+))?$/', $path, $matches)) {
    // Handle /aggregators/*
    $subpath = isset($matches[1]) ? $matches[1] : '';
    handleAggregators($subpath);
} elseif (preg_match('/^integrations\/settings$/', $path)) {
    // Handle /integrations/settings
    handleIntegrationsSettings();
} elseif (preg_match('/^integrations\/status$/', $path)) {
    // Handle /integrations/status
    handleIntegrationsStatus();
} elseif (preg_match('/^integrations\/test$/', $path)) {
    // Handle /integrations/test
    handleIntegrationsTest();
} elseif (preg_match('/^integrations\/jobs$/', $path)) {
    // Handle /integrations/jobs
    handleIntegrationsJobs();
} elseif (preg_match('/^integrations\/events$/', $path)) {
    // Handle /integrations/events
    handleIntegrationsEvents();
} elseif (preg_match('/^pos\/webhook\/(order-created|receipt-created|refund-created)$/', $path, $matches)) {
    handlePosWebhook($pdo, $matches[1]);
} else {
    switch ($path) {
        case 'products':
            handleProducts($pdo);
            break;
        case 'orders':
            handleOrders($pdo);
            break;
        case 'categories':
            handleCategories($pdo);
            break;
        case 'importProducts':
            handleImportProducts($pdo);
            break;
        case 'importFromJSON':
            handleImportFromJSON($pdo);
            break;
        default:
            http_response_code(404);
            error_log("404 Not Found: METHOD=" . $_SERVER['REQUEST_METHOD'] . ", PATH=" . $path);
            echo json_encode(['error' => 'Not found', 'path' => $path, 'method' => $_SERVER['REQUEST_METHOD']]);
            break;
    }
}

// Функция для запуска миграций (добавление новых колонок в существующие таблицы)
function ensureProductCategoryTable($pdo) {
    try {
        $result = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='product_category'");
        $exists = $result ? $result->fetch(PDO::FETCH_ASSOC) : false;
        if (!$exists) {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS product_category (
                    product_id INTEGER NOT NULL,
                    category_id INTEGER NOT NULL,
                    PRIMARY KEY (product_id, category_id),
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
                )
            ");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_product_category_product ON product_category(product_id)");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_product_category_category ON product_category(category_id)");
            error_log('Migration: ensured product_category table exists');
        }
    } catch (Exception $e) {
        error_log("ensureProductCategoryTable error: " . $e->getMessage());
    }
}

function ensureMenuSectionsTable($pdo) {
    try {
        $result = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='menu_sections'");
        $exists = $result ? $result->fetch(PDO::FETCH_ASSOC) : false;
        if (!$exists) {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS menu_sections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category_id INTEGER UNIQUE,
                    section_template TEXT DEFAULT 'grid',
                    items_per_row INTEGER DEFAULT 4,
                    background_style TEXT,
                    icon TEXT,
                    custom_css TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
                )
            ");
            error_log('Migration: ensured menu_sections table exists');
        }
    } catch (Exception $e) {
        error_log("ensureMenuSectionsTable error: " . $e->getMessage());
    }
}

function ensureItemsTable($pdo) {
    try {
        $result = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='items'");
        $exists = $result ? $result->fetch(PDO::FETCH_ASSOC) : false;
        
        if (!$exists) {
            // Таблица не существует - создаём
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    org_id INTEGER,
                    type TEXT CHECK (type IN ('good','service','dish','ingredient','bundle')) DEFAULT 'good',
                    sku TEXT UNIQUE,
                    name TEXT NOT NULL,
                    group_id INTEGER,
                    description_short TEXT,
                    description TEXT,
                    attributes TEXT,
                    is_visible BOOLEAN DEFAULT 1,
                    status TEXT CHECK (status IN ('draft','published','archived')) DEFAULT 'draft',
                    display_only INTEGER DEFAULT 0,
                    parent_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ");
            // Create indexes for new fields
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_items_parent_id ON items(parent_id)");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_items_display_only ON items(display_only)");
            
            error_log('Migration: ensured items table exists');
        }
    } catch (Exception $e) {
        error_log("ensureItemsTable error: " . $e->getMessage());
    }
}

function ensureItemOptionsTable($pdo) {
    try {
        $result = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='item_options'");
        $exists = $result ? $result->fetch(PDO::FETCH_ASSOC) : false;
        
        if (!$exists) {
            // Таблица не существует - создаём
            // ВАЖНО: Не используем FOREIGN KEY, чтобы избежать проблем, если таблица items не существует
            // Модификаторы могут быть глобальными (item_id = NULL) или привязанными к товару
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS item_options (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id INTEGER,
                    group_code TEXT,
                    group_name TEXT,
                    type TEXT CHECK (type IN ('switch','checkbox','quantity','group')),
                    option_code TEXT,
                    option_name TEXT,
                    price_mode TEXT CHECK (price_mode IN ('fixed','percent')) DEFAULT 'fixed',
                    price_value DECIMAL(10,2),
                    max_qty INTEGER,
                    default_on BOOLEAN DEFAULT 0,
                    is_visible BOOLEAN DEFAULT 1,
                    sort_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ");
            
            // Создаём индексы для оптимизации
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_item_options_item_id ON item_options(item_id)");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_item_options_group_name ON item_options(group_name)");
            
            error_log('Migration: ensured item_options table exists');
        }

        // ✅ show_in_product_card для модификаторов (должен быть всегда, даже на свежей таблице)
        try {
            $pdo->exec("ALTER TABLE item_options ADD COLUMN show_in_product_card BOOLEAN DEFAULT 1");
        } catch (Exception $e) {
            // Column already exists
        }

        try {
            $pdo->exec("ALTER TABLE item_options ADD COLUMN image_url TEXT");
        } catch (Exception $e) {
            // Column already exists
        }
        
        // ✅ Всегда проверяем и создаём таблицу связи с категориями
        try {
            // Убираем FOREIGN KEY, чтобы избежать ошибок если таблицы не существуют
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS item_option_category (
                    item_option_id INTEGER NOT NULL,
                    category_id INTEGER NOT NULL,
                    PRIMARY KEY (item_option_id, category_id)
                )
            ");
            // Создаём индексы для оптимизации
            try {
                $pdo->exec("CREATE INDEX IF NOT EXISTS idx_item_option_category_option ON item_option_category(item_option_id)");
                $pdo->exec("CREATE INDEX IF NOT EXISTS idx_item_option_category_category ON item_option_category(category_id)");
            } catch (Exception $e) {
                // Игнорируем ошибки индексов
            }
        } catch (Exception $e) {
            // Игнорируем ошибки, если таблица уже существует
            error_log('Note: item_option_category table creation: ' . $e->getMessage());
        }
        
        if ($exists) {
            // Таблица существует - проверяем структуру и создаём индексы
            try {
                $pdo->exec("CREATE INDEX IF NOT EXISTS idx_item_options_item_id ON item_options(item_id)");
                $pdo->exec("CREATE INDEX IF NOT EXISTS idx_item_options_group_name ON item_options(group_name)");
            } catch (Exception $e) {
                // Индексы уже существуют или ошибка - игнорируем
            }
        }

        seedDefaultTastyModifiers($pdo);
    } catch (Exception $e) {
        error_log("ensureItemOptionsTable error: " . $e->getMessage());
    }
}

function seedDefaultTastyModifiers($pdo) {
    try {
        $stmt = $pdo->prepare("SELECT id, option_name FROM item_options WHERE lower(option_name) IN (lower(?), lower(?), lower(?), lower(?))");
        $stmt->execute(['Сырный бортик', 'Пряная говядина', 'Моцарелла', 'Халапеньо']);
        $existing = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $have = [];
        foreach ($existing as $row) {
            $have[mb_strtolower((string)($row['option_name'] ?? ''))] = true;
        }

        $defaults = [
            ['code' => 'cheese', 'name' => 'Сырный бортик', 'price' => 179, 'order' => 10],
            ['code' => 'pepperoni', 'name' => 'Пряная говядина', 'price' => 119, 'order' => 20],
            ['code' => 'mushrooms', 'name' => 'Моцарелла', 'price' => 79, 'order' => 30],
            ['code' => 'jalapeno', 'name' => 'Халапеньо', 'price' => 99, 'order' => 40]
        ];

        $ins = $pdo->prepare("INSERT INTO item_options (item_id, group_code, group_name, type, option_code, option_name, image_url, price_mode, price_value, max_qty, default_on, is_visible, show_in_product_card, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

        foreach ($defaults as $d) {
            $key = mb_strtolower($d['name']);
            if (isset($have[$key])) {
                continue;
            }
            $ins->execute([
                null,
                'tasty',
                'Добавить по вкусу',
                'checkbox',
                $d['code'],
                $d['name'],
                null,
                'fixed',
                $d['price'],
                null,
                0,
                1,
                1,
                $d['order']
            ]);
        }
    } catch (Exception $e) {
        error_log('seedDefaultTastyModifiers error: ' . $e->getMessage());
    }
}

function ensureCategoriesSchema($pdo) {
    static $checked = false;
    if ($checked) {
        return;
    }

    try {
        $columns = $pdo->query("PRAGMA table_info(categories)")->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_column($columns, 'name');

            $required = [
            'parent_id' => "ALTER TABLE categories ADD COLUMN parent_id INTEGER",
            'type' => "ALTER TABLE categories ADD COLUMN type TEXT CHECK (type IN ('menu', 'stock')) DEFAULT 'menu'",
            'description' => "ALTER TABLE categories ADD COLUMN description TEXT",
            'seo_title' => "ALTER TABLE categories ADD COLUMN seo_title TEXT",
            'seo_description' => "ALTER TABLE categories ADD COLUMN seo_description TEXT",
            'seo_keywords' => "ALTER TABLE categories ADD COLUMN seo_keywords TEXT",
            'position' => "ALTER TABLE categories ADD COLUMN position INTEGER DEFAULT 0",
            'show_on_site' => "ALTER TABLE categories ADD COLUMN show_on_site BOOLEAN DEFAULT 1",
            'show_in_nav' => "ALTER TABLE categories ADD COLUMN show_in_nav BOOLEAN DEFAULT 1",
            'show_in_product_card' => "ALTER TABLE categories ADD COLUMN show_in_product_card BOOLEAN DEFAULT 1",
            'created_at' => "ALTER TABLE categories ADD COLUMN created_at DATETIME",
            'updated_at' => "ALTER TABLE categories ADD COLUMN updated_at DATETIME",
            'icon' => "ALTER TABLE categories ADD COLUMN icon TEXT",
            'color' => "ALTER TABLE categories ADD COLUMN color TEXT"
        ];

        foreach ($required as $column => $sql) {
            if (!in_array($column, $columnNames, true)) {
                $pdo->exec($sql);
            }
        }

        if (!in_array('created_at', $columnNames, true)) {
            try {
                $pdo->exec("UPDATE categories SET created_at = datetime('now') WHERE created_at IS NULL");
            } catch (Exception $e) {
                // ignore
            }
        }
        if (!in_array('updated_at', $columnNames, true)) {
            try {
                $pdo->exec("UPDATE categories SET updated_at = datetime('now') WHERE updated_at IS NULL");
            } catch (Exception $e) {
                // ignore
            }
        }
    } catch (Exception $e) {
        error_log("ensureCategoriesSchema warning: " . $e->getMessage());
    }

    $checked = true;
}

function runMigrations($pdo) {
    try {
        // Миграция для таблицы products: добавляем недостающие колонки
        $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_column($columns, 'name');
        
        if (!in_array('sku', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN sku TEXT");
            error_log("Migration: Added 'sku' column to products table");
        }
        if (!in_array('weight', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN weight TEXT");
            error_log("Migration: Added 'weight' column to products table");
        }
        if (!in_array('calories', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN calories TEXT");
            error_log("Migration: Added 'calories' column to products table");
        }
        if (!in_array('cost', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN cost DECIMAL(10,2) DEFAULT 0");
            error_log("Migration: Added 'cost' column to products table");
        }
        if (!in_array('tax_type', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN tax_type TEXT CHECK (tax_type IN ('alcohol', 'excise', 'none')) DEFAULT 'none'");
            error_log("Migration: Added 'tax_type' column to products table");
        }
        if (!in_array('vat_rate', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN vat_rate TEXT");
            error_log("Migration: Added 'vat_rate' column to products table");
        }

        if (!in_array('category_id', $columnNames, true)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN category_id INTEGER");
            error_log("Migration: Added 'category_id' column to products table");
        }

        if (!in_array('size_label', $columnNames, true)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN size_label TEXT");
            error_log("Migration: Added 'size_label' column to products table");
        }
        if (!in_array('diameter', $columnNames, true)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN diameter INTEGER");
            error_log("Migration: Added 'diameter' column to products table");
        }
        if (!in_array('recipe_coefficient', $columnNames, true)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN recipe_coefficient DECIMAL(5,3) DEFAULT 1.000");
            error_log("Migration: Added 'recipe_coefficient' column to products table");
        }
        if (!in_array('is_active', $columnNames, true)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT 1");
            error_log("Migration: Added 'is_active' column to products table");
        }
        if (!in_array('sort_order', $columnNames, true)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0");
            error_log("Migration: Added 'sort_order' column to products table");
        }
        
        // Миграция для таблицы categories: добавляем новые поля
        $catColumns = $pdo->query("PRAGMA table_info(categories)")->fetchAll(PDO::FETCH_ASSOC);
        $catColumnNames = array_column($catColumns, 'name');
        
        if (!in_array('parent_id', $catColumnNames)) {
            $pdo->exec("ALTER TABLE categories ADD COLUMN parent_id INTEGER");
            error_log("Migration: Added 'parent_id' column to categories table");
        }
        if (!in_array('description', $catColumnNames)) {
            $pdo->exec("ALTER TABLE categories ADD COLUMN description TEXT");
            error_log("Migration: Added 'description' column to categories table");
        }
        if (!in_array('seo_title', $catColumnNames)) {
            $pdo->exec("ALTER TABLE categories ADD COLUMN seo_title TEXT");
            error_log("Migration: Added 'seo_title' column to categories table");
        }
        if (!in_array('seo_description', $catColumnNames)) {
            $pdo->exec("ALTER TABLE categories ADD COLUMN seo_description TEXT");
            error_log("Migration: Added 'seo_description' column to categories table");
        }
        if (!in_array('seo_keywords', $catColumnNames)) {
            $pdo->exec("ALTER TABLE categories ADD COLUMN seo_keywords TEXT");
            error_log("Migration: Added 'seo_keywords' column to categories table");
        }
        if (!in_array('position', $catColumnNames)) {
            // Переименовываем sort_order в position, если нужно
            if (in_array('sort_order', $catColumnNames)) {
                $pdo->exec("ALTER TABLE categories ADD COLUMN position INTEGER DEFAULT 0");
                $pdo->exec("UPDATE categories SET position = sort_order");
                error_log("Migration: Added 'position' column to categories table");
            } else {
                $pdo->exec("ALTER TABLE categories ADD COLUMN position INTEGER DEFAULT 0");
                error_log("Migration: Added 'position' column to categories table");
            }
        }
        if (!in_array('show_on_site', $catColumnNames)) {
            $pdo->exec("ALTER TABLE categories ADD COLUMN show_on_site BOOLEAN DEFAULT 1");
            error_log("Migration: Added 'show_on_site' column to categories table");
        }
        if (!in_array('show_in_nav', $catColumnNames)) {
            $pdo->exec("ALTER TABLE categories ADD COLUMN show_in_nav BOOLEAN DEFAULT 1");
            error_log("Migration: Added 'show_in_nav' column to categories table");
        }
        if (!in_array('show_in_product_card', $catColumnNames)) {
            $pdo->exec("ALTER TABLE categories ADD COLUMN show_in_product_card BOOLEAN DEFAULT 1");
            error_log("Migration: Added 'show_in_product_card' column to categories table");
        }
        if (!in_array('type', $catColumnNames)) {
            $pdo->exec("ALTER TABLE categories ADD COLUMN type TEXT CHECK (type IN ('menu', 'stock')) DEFAULT 'menu'");
            // Обновляем существующие категории - по умолчанию menu
            $pdo->exec("UPDATE categories SET type = 'menu' WHERE type IS NULL");
            error_log("Migration: Added 'type' column to categories table");
        }
        if (!in_array('created_at', $catColumnNames)) {
            $pdo->exec("ALTER TABLE categories ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
            error_log("Migration: Added 'created_at' column to categories table");
        }
        if (!in_array('updated_at', $catColumnNames)) {
            $pdo->exec("ALTER TABLE categories ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
            error_log("Migration: Added 'updated_at' column to categories table");
        }

        if (!in_array('external_id', $catColumnNames, true)) {
            $pdo->exec("ALTER TABLE categories ADD COLUMN external_id TEXT");
            try {
                $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_external_id ON categories(external_id)");
            } catch (Exception $e) {
                // ignore
            }
            error_log("Migration: Added 'external_id' column to categories table");
        }
        
        // Создаем таблицу product_category, если её нет
        $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='product_category'")->fetchAll();
        if (empty($tables)) {
            $pdo->exec("
                CREATE TABLE product_category (
                    product_id INTEGER NOT NULL,
                    category_id INTEGER NOT NULL,
                    PRIMARY KEY (product_id, category_id),
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
                )
            ");
            error_log("Migration: Created 'product_category' table");
            
            // Миграция существующих данных: переносим category из products в product_category
            $products = $pdo->query("SELECT id, category FROM products WHERE category IS NOT NULL AND category != ''")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($products as $product) {
                // Ищем категорию по slug или name
                $stmt = $pdo->prepare("SELECT id FROM categories WHERE slug = ? OR name = ? LIMIT 1");
                $stmt->execute([$product['category'], $product['category']]);
                $category = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($category) {
                    try {
                        $stmt = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
                        $stmt->execute([$product['id'], $category['id']]);
                    } catch (Exception $e) {
                        error_log("Migration warning: Could not link product {$product['id']} to category {$category['id']}: " . $e->getMessage());
                    }
                }
            }
            error_log("Migration: Migrated existing product-category relationships");
        }

        $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='item_modifiers'")->fetchAll();
        if (empty($tables)) {
            $pdo->exec("
                CREATE TABLE item_modifiers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id INTEGER NOT NULL,
                    modifier_id INTEGER NOT NULL,
                    min_quantity INTEGER DEFAULT 0,
                    max_quantity INTEGER DEFAULT 10,
                    is_default BOOLEAN DEFAULT 0,
                    sort_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (item_id, modifier_id),
                    FOREIGN KEY (item_id) REFERENCES products(id) ON DELETE CASCADE,
                    FOREIGN KEY (modifier_id) REFERENCES products(id) ON DELETE CASCADE
                )
            ");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_item_modifiers_item ON item_modifiers(item_id)");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_item_modifiers_modifier ON item_modifiers(modifier_id)");
            error_log("Migration: Created 'item_modifiers' table");
        }
        
        // Миграция: устанавливаем категории по умолчанию для товаров без категорий
        try {
            // Находим товары без категорий
            $productsWithoutCategories = $pdo->query("
                SELECT p.id, p.type, p.name 
                FROM products p
                LEFT JOIN product_category pc ON p.id = pc.product_id
                WHERE pc.product_id IS NULL
            ")->fetchAll(PDO::FETCH_ASSOC);
            
            if (!empty($productsWithoutCategories)) {
                // Создаём или находим категорию "Другое" для меню
                $defaultCategoryStmt = $pdo->prepare("SELECT id FROM categories WHERE slug = 'other' OR name = 'Другое' LIMIT 1");
                $defaultCategoryStmt->execute();
                $defaultCategory = $defaultCategoryStmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$defaultCategory) {
                    // Создаём категорию "Другое"
                    $pdo->exec("
                        INSERT INTO categories (name, slug, type, show_on_site, show_in_nav, position)
                        VALUES ('Другое', 'other', 'menu', 1, 1, 999)
                    ");
                    $defaultCategoryId = $pdo->lastInsertId();
                } else {
                    $defaultCategoryId = $defaultCategory['id'];
                }
                
                // Привязываем товары к категории "Другое"
                $linkStmt = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
                $linkedCount = 0;
                foreach ($productsWithoutCategories as $product) {
                    try {
                        $linkStmt->execute([$product['id'], $defaultCategoryId]);
                        $linkedCount++;
                    } catch (Exception $e) {
                        error_log("Migration warning: Could not link product {$product['id']} to default category: " . $e->getMessage());
                    }
                }
                if ($linkedCount > 0) {
                    error_log("Migration: Linked $linkedCount products without categories to default category 'Другое'");
                }
            }
        } catch (Exception $e) {
            error_log("Migration warning: Error setting default categories: " . $e->getMessage());
        }
        
        // Создаем таблицу menu_sections, если её нет
        $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='menu_sections'")->fetchAll();
        if (empty($tables)) {
            $pdo->exec("
                CREATE TABLE menu_sections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category_id INTEGER UNIQUE,
                    section_template TEXT DEFAULT 'grid',
                    items_per_row INTEGER DEFAULT 4,
                    background_style TEXT,
                    icon TEXT,
                    custom_css TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
                )
            ");
            error_log("Migration: Created 'menu_sections' table");
        }
        if (!in_array('visible_on_site', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN visible_on_site BOOLEAN DEFAULT 1");
            error_log("Migration: Added 'visible_on_site' column to products table");
        }
        if (!in_array('group_id', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN group_id INTEGER");
            error_log("Migration: Added 'group_id' column to products table");
        }
        if (!in_array('type', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN type TEXT DEFAULT 'product'");
            error_log("Migration: Added 'type' column to products table");
        }
        if (!in_array('parent_product_id', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN parent_product_id INTEGER");
            error_log("Migration: Added 'parent_product_id' column to products table for subgroups");
        }
        if (!in_array('is_showcase_parent', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN is_showcase_parent INTEGER DEFAULT 0");
            error_log("Migration: Added 'is_showcase_parent' column to products table");
        }
        if (!in_array('skip_inventory', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN skip_inventory INTEGER DEFAULT 0");
            error_log("Migration: Added 'skip_inventory' column to products table");
        }
        // Backward-compat aliases for TZ/legacy imports
        if (!in_array('display_only', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN display_only INTEGER DEFAULT 0");
            error_log("Migration: Added 'display_only' column to products table");
        }
        if (!in_array('parent_sku', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN parent_sku TEXT");
            error_log("Migration: Added 'parent_sku' column to products table");
        }
        if (!in_array('category_stock', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN category_stock INTEGER");
            error_log("Migration: Added 'category_stock' column to products table");
        }
        if (!in_array('loss_percentage', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN loss_percentage DECIMAL(5,2) DEFAULT 0");
            error_log("Migration: Added 'loss_percentage' column to products table");
        }
        if (!in_array('conversion_factor', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN conversion_factor DECIMAL(10,4) DEFAULT 1.0");
            error_log("Migration: Added 'conversion_factor' column to products table");
        }

        // Поля под ТЗ (учёт/закуп/продажа/остатки/поставщики/ТТК)
        $requiredProductColumns = [
            'account_code' => "ALTER TABLE products ADD COLUMN account_code TEXT",
            'purchase_price' => "ALTER TABLE products ADD COLUMN purchase_price DECIMAL(10,2)",
            'sale_price' => "ALTER TABLE products ADD COLUMN sale_price DECIMAL(10,2)",
            'stock_qty' => "ALTER TABLE products ADD COLUMN stock_qty DECIMAL(14,3)",
            'unit' => "ALTER TABLE products ADD COLUMN unit TEXT",
            'category_path' => "ALTER TABLE products ADD COLUMN category_path TEXT",
            'ingredients' => "ALTER TABLE products ADD COLUMN ingredients TEXT",
            'modifiers' => "ALTER TABLE products ADD COLUMN modifiers TEXT",
            'supplier_code' => "ALTER TABLE products ADD COLUMN supplier_code TEXT",
            'contract_number' => "ALTER TABLE products ADD COLUMN contract_number TEXT",
            'payment_term_days' => "ALTER TABLE products ADD COLUMN payment_term_days INTEGER"
        ];

        foreach ($requiredProductColumns as $column => $sql) {
            if (!in_array($column, $columnNames, true)) {
                try {
                    $pdo->exec($sql);
                    error_log("Migration: Added '$column' column to products table");
                } catch (Exception $e) {
                    error_log("Migration warning: Could not add '$column' column to products: " . $e->getMessage());
                }
            }
        }

        // Миграция старых размеров 25/32/33/42 см -> parent/variants
        // Автоматически определяем товары, у которых размер зашит в названии (например: "Белуччи 25 см").
        // Безопасно: трогаем только товары с parent_product_id IS NULL и только если у базы >=2 размеров.
        try {
            $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
            $columnNames = array_column($columns, 'name');
            $hasParentProductId = in_array('parent_product_id', $columnNames);
            $hasIsShowcaseParent = in_array('is_showcase_parent', $columnNames);
            $hasSkipInventory = in_array('skip_inventory', $columnNames);
            $hasDisplayOnly = in_array('display_only', $columnNames);

            if ($hasParentProductId && $hasIsShowcaseParent && $hasSkipInventory) {
                $pattern = '/^(.*?)(?:\s*[-,])?\s*(25|32|33|42)\s*(?:см|cm)\s*$/iu';

                $stmt = $pdo->query("SELECT id, name, description, price, image_url, visible_on_site, type, parent_product_id, is_showcase_parent, skip_inventory FROM products WHERE parent_product_id IS NULL");
                $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

                $byBase = [];
                foreach ($rows as $r) {
                    $name = (string)($r['name'] ?? '');
                    if (!$name) continue;
                    if (preg_match($pattern, $name, $m)) {
                        $base = trim($m[1]);
                        $size = intval($m[2]);
                        if (!$base || $size <= 0) continue;
                        if (!isset($byBase[$base])) $byBase[$base] = [];
                        $r['_size_cm'] = $size;
                        $byBase[$base][] = $r;
                    }
                }

                foreach ($byBase as $baseName => $children) {
                    if (count($children) < 2) continue;

                    // Уже существующий витринный родитель
                    $parentId = null;
                    $pstmt = $pdo->prepare("SELECT id, is_showcase_parent FROM products WHERE parent_product_id IS NULL AND name = ? LIMIT 1");
                    $pstmt->execute([$baseName]);
                    $parentRow = $pstmt->fetch(PDO::FETCH_ASSOC);
                    if ($parentRow && intval($parentRow['is_showcase_parent'] ?? 0) === 1) {
                        $parentId = intval($parentRow['id']);
                    }

                    if ($parentId === null) {
                        // Создаём витринного родителя
                        $minPrice = null;
                        $seed = $children[0];
                        foreach ($children as $c) {
                            $p = array_key_exists('price', $c) ? floatval($c['price']) : null;
                            if ($p !== null && ($minPrice === null || $p < $minPrice)) $minPrice = $p;
                        }
                        $minPrice = $minPrice === null ? 0 : $minPrice;

                        $fields = ['name', 'description', 'price', 'image_url', 'visible_on_site', 'type', 'is_showcase_parent', 'skip_inventory'];
                        $values = [
                            $baseName,
                            $seed['description'] ?? '',
                            $minPrice,
                            $seed['image_url'] ?? '',
                            isset($seed['visible_on_site']) ? (intval($seed['visible_on_site']) ? 1 : 0) : 1,
                            $seed['type'] ?? 'product',
                            1,
                            1
                        ];

                        if ($hasDisplayOnly) {
                            $fields[] = 'display_only';
                            $values[] = 1;
                        }

                        $placeholders = implode(',', array_fill(0, count($fields), '?'));
                        $sql = "INSERT INTO products (" . implode(',', $fields) . ") VALUES ($placeholders)";

                        $pdo->beginTransaction();
                        try {
                            $pdo->prepare($sql)->execute($values);
                            $parentId = intval($pdo->lastInsertId());

                            // Копируем категории от первого ребёнка
                            try {
                                $cStmt = $pdo->prepare("SELECT category_id FROM product_category WHERE product_id = ?");
                                $cStmt->execute([intval($children[0]['id'])]);
                                $cats = $cStmt->fetchAll(PDO::FETCH_COLUMN);
                                if (is_array($cats) && count($cats)) {
                                    $ins = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
                                    foreach ($cats as $cid) {
                                        $ins->execute([$parentId, $cid]);
                                    }
                                }
                            } catch (Exception $e) {
                                // ignore
                            }

                            $pdo->commit();
                            error_log("Migration: Created showcase parent '$baseName' id=$parentId");
                        } catch (Exception $e) {
                            $pdo->rollBack();
                            error_log("Migration warning: Could not create showcase parent '$baseName': " . $e->getMessage());
                            continue;
                        }
                    }

                    // Привязываем детей к родителю (idempotent: только где ещё не задано)
                    $upd = $pdo->prepare("UPDATE products SET parent_product_id = ?, is_showcase_parent = 0 WHERE id = ? AND parent_product_id IS NULL");
                    foreach ($children as $c) {
                        $childId = intval($c['id']);
                        if ($childId <= 0) continue;
                        $upd->execute([$parentId, $childId]);
                    }

                    // Гарантируем флаги родителя
                    $pdo->prepare(
                        "UPDATE products SET is_showcase_parent = 1, skip_inventory = 1" . ($hasDisplayOnly ? ", display_only = 1" : "") . " WHERE id = ?"
                    )->execute([$parentId]);
                }
            }
        } catch (Exception $e) {
            error_log("Migration warning: size variants migration failed: " . $e->getMessage());
        }

        // Ensure recipes table has 'markup' column (used by recipes API)
        try {
            // First ensure recipes table exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS recipes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    category_id INTEGER,
                    product_id INTEGER,
                    output_quantity DECIMAL(10,3) NOT NULL,
                    output_unit TEXT NOT NULL,
                    cooking_time INTEGER,
                    loss_percentage DECIMAL(5,2) DEFAULT 0,
                    cooking_instructions TEXT,
                    ingredients TEXT,
                    cost DECIMAL(10,2) DEFAULT 0,
                    is_active BOOLEAN DEFAULT 1,
                    markup DECIMAL(10,2) DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ");
            
            // Check if markup column exists and add it if needed
            $recipeCols = $pdo->query("PRAGMA table_info(recipes)")->fetchAll(PDO::FETCH_ASSOC);
            $recipeColumnNames = array_column($recipeCols, 'name');
            if (!in_array('markup', $recipeColumnNames)) {
                $pdo->exec("ALTER TABLE recipes ADD COLUMN markup DECIMAL(10,2) DEFAULT 0");
                error_log("Migration: Added 'markup' column to recipes table");
            }
        } catch (Exception $e) {
            error_log("Migration warning: Could not ensure 'markup' column in recipes: " . $e->getMessage());
        }

        // Suppliers / contracts (для накладных 10.1/41.1)
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS suppliers (
                    supplier_code TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    tax_id TEXT,
                    address TEXT,
                    contact_person TEXT,
                    email TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)");
        } catch (Exception $e) {
            error_log("Migration warning: Could not ensure suppliers table: " . $e->getMessage());
        }

        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS supplier_contracts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    supplier_code TEXT NOT NULL,
                    contract_number TEXT NOT NULL,
                    payment_term_days INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (supplier_code, contract_number),
                    FOREIGN KEY (supplier_code) REFERENCES suppliers(supplier_code) ON DELETE CASCADE
                )
            ");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_supplier_contracts_supplier ON supplier_contracts(supplier_code)");
        } catch (Exception $e) {
            error_log("Migration warning: Could not ensure supplier_contracts table: " . $e->getMessage());
        }

        // Warehouses + inventory documents (для receipt/sale/writeoff)
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS inventory_warehouses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_active ON inventory_warehouses(is_active)");

            try {
                $pdo->exec("INSERT OR IGNORE INTO inventory_warehouses (id, name, is_active) VALUES (1, 'Основной склад', 1)");
                $pdo->exec("INSERT OR IGNORE INTO inventory_warehouses (id, name, is_active) VALUES (2, 'Склад №2', 1)");
            } catch (Exception $e) {
                error_log("Migration warning: Could not seed inventory_warehouses: " . $e->getMessage());
            }
        } catch (Exception $e) {
            error_log("Migration warning: Could not ensure inventory_warehouses table: " . $e->getMessage());
        }

        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS inventory_tx (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tx_type TEXT NOT NULL, 
                    doc_number TEXT,
                    doc_date TEXT,
                    status TEXT DEFAULT 'posted',
                    warehouse_id INTEGER,
                    supplier_code TEXT,
                    contract_number TEXT,
                    payment_term_days INTEGER,
                    account_code TEXT,
                    meta TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id) ON DELETE SET NULL
                )
            ");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_inventory_tx_type ON inventory_tx(tx_type)");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_inventory_tx_date ON inventory_tx(doc_date)");
        } catch (Exception $e) {
            error_log("Migration warning: Could not ensure inventory_tx table: " . $e->getMessage());
        }

        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS inventory_tx_lines (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tx_id INTEGER NOT NULL,
                    product_id INTEGER,
                    variant_id INTEGER,
                    qty DECIMAL(14,3) NOT NULL,
                    unit TEXT,
                    purchase_price DECIMAL(10,2),
                    sale_price DECIMAL(10,2),
                    account_code TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (tx_id) REFERENCES inventory_tx(id) ON DELETE CASCADE,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
                )
            ");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_inventory_tx_lines_tx ON inventory_tx_lines(tx_id)");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_inventory_tx_lines_product ON inventory_tx_lines(product_id)");
        } catch (Exception $e) {
            error_log("Migration warning: Could not ensure inventory_tx_lines table: " . $e->getMessage());
        }

        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS inventory_batches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER NOT NULL,
                    warehouse_id INTEGER,
                    receipt_tx_line_id INTEGER,
                    batch_code TEXT,
                    qty DECIMAL(14,3) NOT NULL,
                    unit TEXT,
                    purchase_price DECIMAL(10,2),
                    production_date TEXT,
                    expiry_date TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                    FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id) ON DELETE SET NULL,
                    FOREIGN KEY (receipt_tx_line_id) REFERENCES inventory_tx_lines(id) ON DELETE SET NULL
                )
            ");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_inventory_batches_product ON inventory_batches(product_id)");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON inventory_batches(expiry_date)");
        } catch (Exception $e) {
            error_log("Migration warning: Could not ensure inventory_batches table: " . $e->getMessage());
        }
    } catch (Exception $e) {
        error_log("Migration warning: " . $e->getMessage());
    }

    // Create product_groups table
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS product_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                parent_id INTEGER,
                name TEXT NOT NULL,
                slug TEXT UNIQUE,
                default_unit TEXT,
                default_category_stock INTEGER,
                default_account TEXT,
                default_tax_group TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES product_groups(id) ON DELETE SET NULL
            )
        ");
        error_log("Migration: Created 'product_groups' table");
    } catch (Exception $e) {
        error_log("Migration warning: " . $e->getMessage());
    }
}

function initializeDatabase($pdo) {
    // Create projects table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            domain TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // Insert default project
    $pdo->exec("
        INSERT OR IGNORE INTO projects (id, name, description, domain, status) 
        VALUES (1, 'DANDY Pizza', 'Основной проект DANDY Pizza', 'dandypizzasushi.com', 'active')
    ");
    
    // Create products table (legacy menu products, used by existing UI)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            category TEXT,
            image_url TEXT,
            sku TEXT,
            weight TEXT,
            calories TEXT,
            visible_on_site BOOLEAN DEFAULT 1,
            available BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");

    // === Unified catalog tables (items / variants / options) ===
    // items: master entities (goods / services / dishes / ingredients)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER,
            type TEXT CHECK (type IN ('good','service','dish','ingredient','bundle')) DEFAULT 'good',
            sku TEXT UNIQUE,
            name TEXT NOT NULL,
            group_id INTEGER,
            description_short TEXT,
            description TEXT,
            attributes TEXT, -- JSON string
            is_visible BOOLEAN DEFAULT 1,
            status TEXT CHECK (status IN ('draft','published','archived')) DEFAULT 'draft',
            display_only INTEGER DEFAULT 0,
            parent_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    // Create indexes for parent-child relationships
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_items_parent_id ON items(parent_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_items_display_only ON items(display_only)");

    // item_variants: parameterized variants of items (size, dough, etc.)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS item_variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            sku TEXT,
            barcode TEXT,
            param_set TEXT, -- JSON string, e.g. {\"Размер\":\"30 см\",\"Тесто\":\"тонкое\"}
            price_mode TEXT CHECK (price_mode IN ('fixed','markup','pos')) DEFAULT 'fixed',
            price DECIMAL(10,2),
            old_price DECIMAL(10,2),
            weight_g INTEGER,
            length_cm INTEGER,
            width_cm INTEGER,
            height_cm INTEGER,
            is_visible BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (barcode),
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
        )
    ");

    // item_options: modifiers / add-ons (as in Mottor)
    // ВАЖНО: Не используем FOREIGN KEY, чтобы избежать проблем, если таблица items не существует
    // Модификаторы могут быть глобальными (item_id = NULL) или привязанными к товару
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS item_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER,
            group_code TEXT,
            group_name TEXT,
            type TEXT CHECK (type IN ('switch','checkbox','quantity','group')),
            option_code TEXT,
            option_name TEXT,
            price_mode TEXT CHECK (price_mode IN ('fixed','percent')) DEFAULT 'fixed',
            price_value DECIMAL(10,2),
            max_qty INTEGER,
            default_on BOOLEAN DEFAULT 0,
            is_visible BOOLEAN DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // ✅ Добавлено: Таблица связи модификаторов с категориями
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS item_option_category (
            item_option_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            PRIMARY KEY (item_option_id, category_id),
            FOREIGN KEY (item_option_id) REFERENCES item_options(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        )
    ");

    // import_jobs: background import tasks (for OneFile and others)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS import_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- e.g. onefile
            status TEXT NOT NULL DEFAULT 'pending', -- pending|processing|completed|failed
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_rows INTEGER,
            processed_rows INTEGER,
            error TEXT,
            meta TEXT -- JSON with additional info
        )
    ");

    // Create categories table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id INTEGER,
            name TEXT NOT NULL,
            slug TEXT UNIQUE,
            type TEXT CHECK (type IN ('menu', 'stock')) DEFAULT 'menu',
            description TEXT,
            image_url TEXT,
            icon TEXT,
            color TEXT,
            seo_title TEXT,
            seo_description TEXT,
            seo_keywords TEXT,
            position INTEGER DEFAULT 0,
            show_on_site BOOLEAN DEFAULT 1,
            show_in_nav BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
        )
    ");
    
    // Create product_category table (many-to-many relationship)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS product_category (
            product_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            PRIMARY KEY (product_id, category_id),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        )
    ");
    
    // Create menu_sections table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS menu_sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER UNIQUE,
            section_template TEXT DEFAULT 'grid',
            items_per_row INTEGER DEFAULT 4,
            background_style TEXT,
            icon TEXT,
            custom_css TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        )
    ");
    
    // Create orders table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT,
            phone TEXT,
            address TEXT,
            total DECIMAL(10,2) NOT NULL,
            status TEXT DEFAULT 'pending',
            items TEXT, -- JSON string
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // Create recipes table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            category_id INTEGER,
            output_quantity DECIMAL(10,3) NOT NULL,
            output_unit TEXT NOT NULL,
            cooking_time INTEGER,
            loss_percentage DECIMAL(5,2) DEFAULT 0,
            cooking_instructions TEXT,
            ingredients TEXT, -- JSON string
            cost DECIMAL(10,2) DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // Create promotions table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS promotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL,
            discount_type TEXT,
            discount_value DECIMAL(10,2),
            start_date DATETIME,
            end_date DATETIME,
            min_order_amount DECIMAL(10,2),
            max_uses INTEGER,
            promo_code TEXT,
            status TEXT DEFAULT 'active',
            current_uses INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // Create synced_products table for website menu items
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS synced_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_data TEXT NOT NULL,
            synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // Insert sample data
    insertSampleData($pdo);
}

function insertSampleData($pdo) {
    // Проверяем, есть ли уже категории
    try {
        $existing = $pdo->query("SELECT COUNT(*) as count FROM categories")->fetch(PDO::FETCH_ASSOC);
        if ($existing && $existing['count'] > 0) {
            return; // Категории уже есть, не добавляем тестовые
        }
    } catch (Exception $e) {
        // Таблица не существует или ошибка - пропускаем
        return;
    }
    
    // Sample categories - создаем только если таблица пуста
    $categories = [
        ['name' => 'Пицца', 'slug' => 'pizza', 'position' => 1, 'show_on_site' => 1, 'show_in_nav' => 1],
        ['name' => 'Суши', 'slug' => 'sushi', 'position' => 2, 'show_on_site' => 1, 'show_in_nav' => 1],
        ['name' => 'Напитки', 'slug' => 'drinks', 'position' => 3, 'show_on_site' => 1, 'show_in_nav' => 1],
        ['name' => 'Десерты', 'slug' => 'desserts', 'position' => 4, 'show_on_site' => 1, 'show_in_nav' => 1]
    ];
    
    // Проверяем наличие колонок один раз
    $columnsCheck = $pdo->query("PRAGMA table_info(categories)");
    $columns = $columnsCheck->fetchAll(PDO::FETCH_ASSOC);
    $columnNames = array_column($columns, 'name');
    
    $hasPosition = in_array('position', $columnNames);
    $hasShowOnSite = in_array('show_on_site', $columnNames);
    $hasShowInNav = in_array('show_in_nav', $columnNames);
    
    foreach ($categories as $cat) {
        try {
            if ($hasPosition && $hasShowOnSite && $hasShowInNav) {
                $stmt = $pdo->prepare("INSERT OR IGNORE INTO categories (name, slug, position, show_on_site, show_in_nav) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$cat['name'], $cat['slug'], $cat['position'], $cat['show_on_site'], $cat['show_in_nav']]);
            } elseif ($hasPosition) {
                $stmt = $pdo->prepare("INSERT OR IGNORE INTO categories (name, slug, position) VALUES (?, ?, ?)");
                $stmt->execute([$cat['name'], $cat['slug'], $cat['position']]);
            } else {
                // Старая структура
                $stmt = $pdo->prepare("INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)");
                $stmt->execute([$cat['name'], $cat['slug']]);
            }
        } catch (Exception $e) {
            error_log("Error inserting sample category {$cat['name']}: " . $e->getMessage());
        }
    }
    
    // Sample products
    $products = [
        ['name' => 'Маргарита', 'description' => 'Классическая пицца с томатами и моцареллой', 'price' => 450, 'category' => 'pizza'],
        ['name' => 'Пепперони', 'description' => 'Острая пицца с колбасой пепперони', 'price' => 550, 'category' => 'pizza'],
        ['name' => 'Филадельфия', 'description' => 'Ролл с лососем и сливочным сыром', 'price' => 320, 'category' => 'sushi'],
        ['name' => 'Калифорния', 'description' => 'Ролл с крабом и авокадо', 'price' => 280, 'category' => 'sushi'],
        ['name' => 'Кока-Кола', 'description' => 'Газированный напиток 0.5л', 'price' => 120, 'category' => 'drinks'],
        ['name' => 'Тирамису', 'description' => 'Классический итальянский десерт', 'price' => 250, 'category' => 'desserts']
    ];
    
    foreach ($products as $product) {
        $stmt = $pdo->prepare("INSERT INTO products (name, description, price, category) VALUES (?, ?, ?, ?)");
        $stmt->execute([$product['name'], $product['description'], $product['price'], $product['category']]);
    }
}

function handleProducts($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            try {
                $category = $_GET['category'] ?? null;
                $categoryId = $_GET['category_id'] ?? null;
                $noCategory = isset($_GET['no_category']) && $_GET['no_category'] == '1';
                $parentProductId = $_GET['parent_product_id'] ?? null;
                $onlyParents = isset($_GET['only_parents']) && ($_GET['only_parents'] == '1' || $_GET['only_parents'] === 'true');
                $limit = isset($_GET['limit']) ? intval($_GET['limit']) : null;
                
                // Проверяем наличие колонки visible_on_site
                $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
                $columnNames = array_column($columns, 'name');
                $hasVisibleOnSite = in_array('visible_on_site', $columnNames);
                $hasAvailable = in_array('available', $columnNames);
                $hasParentProductId = in_array('parent_product_id', $columnNames);
                
// Формируем условие WHERE
  $whereConditions = [];
  // Убираем фильтр видимости если запрос из админки для модификаторов
  $forModifiers = isset($_GET['for_modifiers']) && $_GET['for_modifiers'] == '1';
  if (!$forModifiers) {
      if ($hasVisibleOnSite) {
          $whereConditions[] = "visible_on_site = 1";
      } elseif ($hasAvailable) {
          $whereConditions[] = "available = 1";
      }
  }

  // only_parents=true: отдаём только родительские карточки и обычные товары (без parent_product_id)
  if ($onlyParents && $hasParentProductId) {
      $whereConditions[] = "parent_product_id IS NULL";
  }
  $whereClause = !empty($whereConditions) ? "WHERE " . implode(" AND ", $whereConditions) : "";
  
                if ($parentProductId && $hasParentProductId) {
                    // Фильтр по parent_product_id (подгруппы)
                    $sql = "SELECT * FROM products WHERE parent_product_id = ?";
                    if ($hasVisibleOnSite) {
                        $sql .= " AND visible_on_site = 1";
                    } elseif ($hasAvailable) {
                        $sql .= " AND available = 1";
                    }
                    $sql .= " ORDER BY name";
                    if ($limit) {
                        $sql .= " LIMIT " . intval($limit);
                    }
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([$parentProductId]);
                } elseif ($categoryId) {
                    // Фильтр по ID категории через product_category
                    $sql = "
                        SELECT DISTINCT p.* FROM products p
                        INNER JOIN product_category pc ON p.id = pc.product_id
                        WHERE pc.category_id = ?" . ($hasVisibleOnSite ? " AND p.visible_on_site = 1" : ($hasAvailable ? " AND p.available = 1" : "")) . "
                        ORDER BY p.name
                    ";
                    if ($limit) {
                        $sql .= " LIMIT " . intval($limit);
                    }
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([$categoryId]);
                } elseif ($noCategory) {
                    // Товары без категорий (нет записей в product_category)
                    $includeSubgroups = isset($_GET['include_subgroups']) && $_GET['include_subgroups'] == '1';
                    $subgroupsClause = '';
                    if ($hasParentProductId && !$includeSubgroups) {
                        $subgroupsClause = " AND p.parent_product_id IS NULL";
                    }
                    $visibleClause = $hasVisibleOnSite ? " AND p.visible_on_site = 1" : ($hasAvailable ? " AND p.available = 1" : "");
                    $sql = "
                        SELECT p.* FROM products p
                        LEFT JOIN product_category pc ON p.id = pc.product_id
                        WHERE pc.product_id IS NULL" . $visibleClause . $subgroupsClause . "
                        ORDER BY p.name
                    ";
                    if ($limit) {
                        $sql .= " LIMIT " . intval($limit);
                    }
                    $stmt = $pdo->query($sql);
                } elseif ($category) {
                    // Старый способ фильтрации по slug/name категории
                    $sql = "SELECT * FROM products WHERE " . ($hasAvailable ? "available = 1" : "1=1") . " AND category = ?";
                    if ($limit) {
                        $sql .= " LIMIT " . intval($limit);
                    }
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([$category]);
                } else {
                    // Все товары (исключаем подгруппы по умолчанию, если не запрошены явно)
                    $includeSubgroups = isset($_GET['include_subgroups']) && $_GET['include_subgroups'] == '1';
                    if ($hasParentProductId && !$includeSubgroups) {
                        $whereConditions[] = "parent_product_id IS NULL";
                        $whereClause = !empty($whereConditions) ? "WHERE " . implode(" AND ", $whereConditions) : "";
                    }
                    $sql = "SELECT * FROM products $whereClause ORDER BY name";
                    if ($limit) {
                        $sql .= " LIMIT " . intval($limit);
                    }
                    $stmt = $pdo->query($sql);
                }
                
                $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Добавляем категории для каждого товара
                foreach ($products as &$product) {
                    try {
                        $catStmt = $pdo->prepare("
                            SELECT c.id, c.name, c.slug 
                            FROM categories c
                            INNER JOIN product_category pc ON c.id = pc.category_id
                            WHERE pc.product_id = ?
                        ");
                        $catStmt->execute([$product['id']]);
                        $product['categories'] = $catStmt->fetchAll(PDO::FETCH_ASSOC);
                        $product['category_ids'] = array_column($product['categories'], 'id');
                        
                        // Если нет категорий через product_category, используем старую колонку category
                        if (empty($product['categories']) && !empty($product['category'])) {
                            $product['category_name'] = $product['category'];
                        }
                    } catch (Exception $e) {
                        error_log("Error loading categories for product {$product['id']}: " . $e->getMessage());
                        $product['categories'] = [];
                        $product['category_ids'] = [];
                    }

                    // ✅ КРИТИЧНО: распаковываем product_data (модификаторы/варианты/upsell) чтобы админка видела сохраненные связи
                    if (isset($product['product_data']) && !empty($product['product_data'])) {
                        try {
                            $productData = json_decode($product['product_data'], true);
                            if (is_array($productData)) {
                                if (isset($productData['modifiers'])) {
                                    $product['modifiers'] = $productData['modifiers'];
                                }
                                // variations: богатый формат для витрины (parameters/quantity)
                                if (isset($productData['variations'])) {
                                    $product['variations'] = $productData['variations'];
                                } elseif (isset($productData['variants'])) {
                                    // обратная совместимость
                                    $product['variations'] = $productData['variants'];
                                }
                                // variants: простой формат для админ-редактора (name/price/stock)
                                if (isset($productData['variants'])) {
                                    $product['variants'] = $productData['variants'];
                                }
                                if (isset($productData['related_products'])) {
                                    $product['related_products'] = $productData['related_products'];
                                }
                            }
                        } catch (Exception $e) {
                            // игнорируем ошибки парсинга JSON
                        }
                    }

                    // variants_count: количество дочерних вариантов (если поддерживается parent_product_id)
                    if ($hasParentProductId) {
                        try {
                            $cStmt = $pdo->prepare("SELECT COUNT(1) as cnt FROM products WHERE parent_product_id = ?");
                            $cStmt->execute([$product['id']]);
                            $row = $cStmt->fetch(PDO::FETCH_ASSOC);
                            $product['variants_count'] = intval($row['cnt'] ?? 0);
                        } catch (Exception $e) {
                            $product['variants_count'] = 0;
                        }

                        // min_variant_price: минимальная цена среди дочерних вариантов (для витрины "от")
                        if (intval($product['variants_count'] ?? 0) > 0) {
                            try {
                                $mStmt = $pdo->prepare("SELECT MIN(COALESCE(price, 0)) as minp FROM products WHERE parent_product_id = ? AND price IS NOT NULL AND price > 0");
                                $mStmt->execute([$product['id']]);
                                $mRow = $mStmt->fetch(PDO::FETCH_ASSOC);
                                $minp = isset($mRow['minp']) ? floatval($mRow['minp']) : 0;
                                if ($minp > 0) {
                                    $product['min_variant_price'] = $minp;
                                }
                            } catch (Exception $e) {
                                // ignore
                            }
                        }
                    }
                }
                
                // Отладка: логируем первый товар для проверки полей
                if (!empty($products)) {
                    $sample = $products[0];
                    error_log("API GET /products - Пример товара: id={$sample['id']}, name={$sample['name']}, sku=" . ($sample['sku'] ?? 'NULL') . ", cost=" . ($sample['cost'] ?? 'NULL') . ", weight=" . ($sample['weight'] ?? 'NULL') . ", calories=" . ($sample['calories'] ?? 'NULL'));
                }
                
                echo json_encode(['success' => true, 'data' => $products]);
            } catch (Exception $e) {
                error_log("Error in handleProducts GET: " . $e->getMessage());
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage(),
                    'file' => basename($e->getFile()),
                    'line' => $e->getLine()
                ]);
            }
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                // Логируем что пришло
                error_log("Create product request: " . json_encode($input));
                
                // Проверяем обязательные поля
                if (empty($input['name'])) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Name is required']);
                    return;
                }
                
                // Используем значения по умолчанию для необязательных полей
                $name = $input['name'];
                $description = $input['description'] ?? $input['short_description'] ?? $input['full_description'] ?? '';
                $price = isset($input['price']) ? floatval($input['price']) : 0;
                
                // Обрабатываем категории (может быть массив или строка)
                $category = '';
                $categoryIds = [];
                
                if (isset($input['category_ids']) && is_array($input['category_ids'])) {
                    $categoryIds = $input['category_ids'];
                } elseif (isset($input['categories']) && is_array($input['categories'])) {
                    $categoryIds = array_map(function($cat) {
                        return is_array($cat) ? $cat['id'] : $cat;
                    }, $input['categories']);
                } elseif (isset($input['category'])) {
                    $category = is_array($input['category']) ? implode(',', $input['category']) : $input['category'];
                    // Если это строка, пытаемся найти категорию по slug/name
                    if (!empty($category) && !is_numeric($category)) {
                        $catStmt = $pdo->prepare("SELECT id FROM categories WHERE slug = ? OR name = ? LIMIT 1");
                        $catStmt->execute([$category, $category]);
                        $foundCat = $catStmt->fetch(PDO::FETCH_ASSOC);
                        if ($foundCat) {
                            $categoryIds = [$foundCat['id']];
                        }
                    } elseif (is_numeric($category)) {
                        $categoryIds = [$category];
                    }
                }
                
                $sku = $input['sku'] ?? '';
                $image_url = $input['image_url'] ?? '';
                $weight = $input['weight'] ?? null;
                $calories = $input['calories'] ?? null;
                $visible = isset($input['visible_on_site']) ? ($input['visible_on_site'] ? 1 : 0) : 1;
                
                // Валидация и обработка НДС
                $vatRate = null;
                if (isset($input['vat_rate']) && !empty($input['vat_rate'])) {
                    $vatRate = parseVATRate($input['vat_rate']);
                }
                
                // Обработка типа налогообложения
                $taxType = isset($input['tax_type']) && in_array($input['tax_type'], ['alcohol', 'excise', 'none']) 
                    ? $input['tax_type'] 
                    : 'none';
                
                $pdo->beginTransaction();
                
                // Проверяем наличие колонок vat_rate и tax_type
                $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
                $columnNames = array_column($columns, 'name');
                $hasVatRate = in_array('vat_rate', $columnNames);
                $hasTaxType = in_array('tax_type', $columnNames);
                $hasParentProductId = in_array('parent_product_id', $columnNames);
                $hasIsShowcaseParent = in_array('is_showcase_parent', $columnNames);
                $hasSkipInventory = in_array('skip_inventory', $columnNames);
                $hasDisplayOnly = in_array('display_only', $columnNames);
                $hasParentSku = in_array('parent_sku', $columnNames);

                // ✅ Совместимость (по ТЗ): display_only -> is_showcase_parent (+ default skip_inventory)
                if (isset($input['display_only']) && !isset($input['is_showcase_parent'])) {
                    $input['is_showcase_parent'] = $input['display_only'] ? 1 : 0;
                }
                if ((isset($input['display_only']) && $input['display_only']) && !isset($input['skip_inventory'])) {
                    $input['skip_inventory'] = 1;
                }

                // ✅ Совместимость: parent_sku -> parent_product_id
                if ($hasParentProductId && !isset($input['parent_product_id']) && isset($input['parent_sku']) && $input['parent_sku'] !== '') {
                    try {
                        $psku = trim((string)$input['parent_sku']);
                        $pstmt = $pdo->prepare("SELECT id FROM products WHERE sku = ? LIMIT 1");
                        $pstmt->execute([$psku]);
                        $prow = $pstmt->fetch(PDO::FETCH_ASSOC);
                        if ($prow && isset($prow['id'])) {
                            $input['parent_product_id'] = intval($prow['id']);
                        }
                    } catch (Exception $e) {
                        // ignore
                    }
                }
                
                // Формируем SQL динамически в зависимости от наличия колонок
                $fields = ['name', 'description', 'price', 'category', 'sku', 'image_url', 'weight', 'calories', 'visible_on_site'];
                $values = [$name, $description, $price, $category, $sku, $image_url, $weight, $calories, $visible];
                $placeholders = ['?', '?', '?', '?', '?', '?', '?', '?', '?'];
                
                if ($hasVatRate) {
                    $fields[] = 'vat_rate';
                    $values[] = $vatRate;
                    $placeholders[] = '?';
                }
                if ($hasTaxType) {
                    $fields[] = 'tax_type';
                    $values[] = $taxType;
                    $placeholders[] = '?';
                }
                if ($hasParentProductId && isset($input['parent_product_id'])) {
                    $fields[] = 'parent_product_id';
                    $values[] = $input['parent_product_id'];
                    $placeholders[] = '?';
                }

                if ($hasIsShowcaseParent && isset($input['is_showcase_parent'])) {
                    $fields[] = 'is_showcase_parent';
                    $values[] = $input['is_showcase_parent'] ? 1 : 0;
                    $placeholders[] = '?';
                }

                if ($hasSkipInventory && isset($input['skip_inventory'])) {
                    $fields[] = 'skip_inventory';
                    $values[] = $input['skip_inventory'] ? 1 : 0;
                    $placeholders[] = '?';
                }

                if ($hasDisplayOnly && isset($input['display_only'])) {
                    $fields[] = 'display_only';
                    $values[] = $input['display_only'] ? 1 : 0;
                    $placeholders[] = '?';
                }

                if ($hasParentSku && isset($input['parent_sku'])) {
                    $fields[] = 'parent_sku';
                    $values[] = $input['parent_sku'];
                    $placeholders[] = '?';
                }
                
                $stmt = $pdo->prepare("
                    INSERT INTO products 
                    (" . implode(', ', $fields) . ") 
                    VALUES (" . implode(', ', $placeholders) . ")
                ");
                
                $result = $stmt->execute($values);
                
                if (!$result) {
                    $pdo->rollBack();
                    throw new Exception('Failed to insert product: ' . implode(', ', $stmt->errorInfo()));
                }
                
                $newId = $pdo->lastInsertId();
                
                // Создаем привязки к категориям
                if (!empty($categoryIds)) {
                    $catStmt = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
                    foreach ($categoryIds as $categoryId) {
                        $catStmt->execute([$newId, $categoryId]);
                    }
                }
                
                $pdo->commit();
                error_log("Product created successfully with ID: $newId");
                
                echo json_encode([
                    'success' => true,
                    'id' => $newId,
                    'message' => 'Product created successfully'
                ]);
            } catch (Exception $e) {
                error_log("Error creating product: " . $e->getMessage());
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage()
                ]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

/**
 * Unified catalog: items (master products)
 * Base version: minimal CRUD for items / variants / options
 */
function handleItems($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];

    switch ($method) {
        case 'GET':
            try {
                $search = $_GET['q'] ?? null;
                $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
                $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;

                $params = [];
                $where = [];
                if ($search) {
                    $where[] = "(name LIKE :q OR sku LIKE :q)";
                    $params[':q'] = '%' . $search . '%';
                }

                $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
                $sql = "SELECT * FROM items $whereSql ORDER BY id DESC LIMIT :limit OFFSET :offset";
                $stmt = $pdo->prepare($sql);
                foreach ($params as $k => $v) {
                    $stmt->bindValue($k, $v, PDO::PARAM_STR);
                }
                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                $stmt->execute();

                $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'data' => $items]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage()
                ]);
            }
            break;

        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true) ?: [];

                if (empty($input['name'])) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Field \"name\" is required']);
                    return;
                }

                // Validate parent_id if provided
                $parentId = isset($input['parent_id']) ? intval($input['parent_id']) : null;
                if ($parentId !== null) {
                    $parentStmt = $pdo->prepare("SELECT id, display_only, parent_id FROM items WHERE id = :parent_id");
                    $parentStmt->execute([':parent_id' => $parentId]);
                    $parent = $parentStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$parent) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'error' => 'Parent item not found']);
                        return;
                    }
                    // Защита от циклических ссылок: parent не может быть вариантом
                    if ($parent['parent_id'] !== null) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'error' => 'Parent cannot be a variant itself']);
                        return;
                    }
                    if (intval($parent['display_only'] ?? 0) !== 1) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'error' => 'Parent item must be display_only']);
                        return;
                    }
                }

                $displayOnly = isset($input['display_only']) ? normalizeBoolInt($input['display_only']) : 0;
                // Валидация: display_only не может иметь parent_id
                if ($displayOnly === 1 && $parentId !== null) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Display-only items cannot have parent_id']);
                    return;
                }
                // Variants cannot be display_only
                if ($parentId !== null) {
                    $displayOnly = 0;
                }

                $sql = "
                    INSERT INTO items (org_id, type, sku, name, group_id, description_short, description, attributes, is_visible, status, display_only, parent_id)
                    VALUES (:org_id, :type, :sku, :name, :group_id, :description_short, :description, :attributes, :is_visible, :status, :display_only, :parent_id)
                ";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':org_id' => $input['org_id'] ?? null,
                    ':type' => $input['type'] ?? 'good',
                    ':sku' => $input['sku'] ?? null,
                    ':name' => $input['name'],
                    ':group_id' => $input['group_id'] ?? null,
                    ':description_short' => $input['description_short'] ?? null,
                    ':description' => $input['description'] ?? null,
                    ':attributes' => isset($input['attributes']) ? json_encode($input['attributes'], JSON_UNESCAPED_UNICODE) : null,
                    ':is_visible' => isset($input['is_visible']) ? (int) (bool) $input['is_visible'] : 1,
                    ':status' => $input['status'] ?? 'draft',
                    ':display_only' => $displayOnly,
                    ':parent_id' => $parentId
                ]);

                $id = $pdo->lastInsertId();
                $item = $pdo->query("SELECT * FROM items WHERE id = " . intval($id))->fetch(PDO::FETCH_ASSOC);

                echo json_encode(['success' => true, 'data' => $item]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage()
                ]);
            }
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
}

function handleSingleItem($pdo, $id) {
    $method = $_SERVER['REQUEST_METHOD'];
    $id = intval($id);

    switch ($method) {
        case 'GET':
            $stmt = $pdo->prepare("SELECT * FROM items WHERE id = :id");
            $stmt->execute([':id' => $id]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$item) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Item not found']);
                return;
            }
            echo json_encode(['success' => true, 'data' => $item]);
            break;

        case 'PATCH':
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            if (empty($input)) {
                echo json_encode(['success' => false, 'error' => 'No fields to update']);
                return;
            }

            // Check if item is a variant (has parent_id)
            $currentStmt = $pdo->prepare("SELECT parent_id, display_only FROM items WHERE id = :id");
            $currentStmt->execute([':id' => $id]);
            $current = $currentStmt->fetch(PDO::FETCH_ASSOC);
            $isVariant = !empty($current['parent_id']);

            $fields = [];
            $params = [':id' => $id];
            $mappings = [
                'org_id', 'type', 'sku', 'name', 'group_id',
                'description_short', 'description', 'is_visible', 'status'
            ];
            foreach ($mappings as $field) {
                if (array_key_exists($field, $input)) {
                    $fields[] = "$field = :$field";
                    $params[":$field"] = $input[$field];
                }
            }
            if (array_key_exists('attributes', $input)) {
                $fields[] = "attributes = :attributes";
                $params[':attributes'] = json_encode($input['attributes'], JSON_UNESCAPED_UNICODE);
            }
            
            // Handle display_only (only for non-variants)
            if (array_key_exists('display_only', $input) && !$isVariant) {
                $fields[] = "display_only = :display_only";
                $params[':display_only'] = normalizeBoolInt($input['display_only']);
            }
            
            // Handle parent_id (only on creation, not update - variants cannot change parent)
            // But we allow setting parent_id if item doesn't have one yet
            if (array_key_exists('parent_id', $input) && !$isVariant) {
                $newParentId = isset($input['parent_id']) ? intval($input['parent_id']) : null;
                if ($newParentId !== null) {
                    $parentStmt = $pdo->prepare("SELECT id, display_only, parent_id FROM items WHERE id = :parent_id");
                    $parentStmt->execute([':parent_id' => $newParentId]);
                    $parent = $parentStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$parent) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'error' => 'Parent item not found']);
                        return;
                    }
                    // Защита от циклических ссылок: parent не может быть вариантом
                    if ($parent['parent_id'] !== null) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'error' => 'Parent cannot be a variant itself']);
                        return;
                    }
                    if (intval($parent['display_only'] ?? 0) !== 1) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'error' => 'Parent item must be display_only']);
                        return;
                    }
                }
                $fields[] = "parent_id = :parent_id";
                $params[':parent_id'] = $newParentId;
                // If setting parent_id, ensure display_only is 0
                $fields[] = "display_only = 0";
            }
            
            // Валидация: display_only не может иметь parent_id
            if (array_key_exists('display_only', $input) && normalizeBoolInt($input['display_only']) === 1) {
                if ($isVariant || $current['parent_id'] !== null) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Display-only items cannot have parent_id']);
                    return;
                }
            }

            if (!$fields) {
                echo json_encode(['success' => false, 'error' => 'No valid fields to update']);
                return;
            }

            $fields[] = "updated_at = CURRENT_TIMESTAMP";
            $sql = "UPDATE items SET " . implode(', ', $fields) . " WHERE id = :id";

            // Log the SQL query and parameters before execution
            error_log("Executing SQL: $sql with params: " . json_encode($params));

            try {
                $stmt = $pdo->prepare($sql);
                $result = $stmt->execute($params);
                if ($result === false) {
                    $err = $stmt->errorInfo();
                    error_log("Product UPDATE failed: " . json_encode($err) . " SQL:" . $sql . " PARAMS:" . json_encode($params));
                }
            } catch (Exception $e) {
                error_log("Exception executing product UPDATE: " . $e->getMessage() . " SQL:" . $sql . " PARAMS:" . json_encode($params));
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Database error', 'message' => $e->getMessage()]);
                return;
            }

            $stmt = $pdo->prepare("SELECT * FROM items WHERE id = :id");
            $stmt->execute([':id' => $id]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $item]);
            break;

        case 'DELETE':
            // Проверяем, есть ли дочерние варианты
            $childrenStmt = $pdo->prepare("SELECT COUNT(*) as count FROM items WHERE parent_id = :id");
            $childrenStmt->execute([':id' => $id]);
            $children = $childrenStmt->fetch(PDO::FETCH_ASSOC);
            $hasChildren = intval($children['count'] ?? 0) > 0;
            
            if ($hasChildren) {
                // CASCADE DELETE: удаляем все дочерние варианты вместе с родителем
                $deleteChildrenStmt = $pdo->prepare("DELETE FROM items WHERE parent_id = :id");
                $deleteChildrenStmt->execute([':id' => $id]);
            }
            
            $stmt = $pdo->prepare("DELETE FROM items WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(['success' => true, 'deleted_children' => $hasChildren ? intval($children['count']) : 0]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
}

function handleItemVariants($pdo, $itemId) {
    $method = $_SERVER['REQUEST_METHOD'];
    $itemId = intval($itemId);

    // Check that parent exists and is display_only
    $parentStmt = $pdo->prepare("SELECT id, name, display_only FROM items WHERE id = :id");
    $parentStmt->execute([':id' => $itemId]);
    $parent = $parentStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$parent) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Parent item not found']);
        return;
    }
    
    if (intval($parent['display_only'] ?? 0) !== 1) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Parent item must be display_only']);
        return;
    }

    switch ($method) {
        case 'GET':
            // Get all variants (items with parent_id = itemId)
            $stmt = $pdo->prepare("SELECT * FROM items WHERE parent_id = :parent_id ORDER BY id");
            $stmt->execute([':parent_id' => $itemId]);
            $variants = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $variants]);
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            
            if (empty($input['sku'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'sku is required for variant']);
                return;
            }

            // Build variant name: parent name + variant name/param
            // Исправление: если name пустое, используем variant_param
            $variantName = $parent['name'];
            if (!empty($input['name']) && trim($input['name']) !== '') {
                $variantName = $parent['name'] . ' ' . trim($input['name']);
            } elseif (!empty($input['variant_param'])) {
                $variantName = $parent['name'] . ' ' . $input['variant_param'];
            } else {
                // Если и name и variant_param пустые, используем SKU как fallback
                $variantName = $parent['name'] . ' (' . ($input['sku'] ?? 'вариант') . ')';
            }

            // Store variant_param in attributes if provided
            $attributes = [];
            if (!empty($input['variant_param'])) {
                $attributes['variant_param'] = $input['variant_param'];
            }
            if (!empty($input['diameter'])) {
                $attributes['diameter'] = $input['diameter'];
            }

            $sql = "
                INSERT INTO items (org_id, type, sku, name, group_id, description_short, description, attributes, is_visible, status, display_only, parent_id)
                VALUES (:org_id, :type, :sku, :name, :group_id, :description_short, :description, :attributes, :is_visible, :status, 0, :parent_id)
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':org_id' => $input['org_id'] ?? null,
                ':type' => $input['type'] ?? $parent['type'] ?? 'good',
                ':sku' => $input['sku'],
                ':name' => $variantName,
                ':group_id' => $input['group_id'] ?? $parent['group_id'] ?? null,
                ':description_short' => $input['description_short'] ?? $parent['description_short'] ?? null,
                ':description' => $input['description'] ?? $parent['description'] ?? null,
                ':attributes' => !empty($attributes) ? json_encode($attributes, JSON_UNESCAPED_UNICODE) : $parent['attributes'] ?? null,
                ':is_visible' => isset($input['is_visible']) ? (int) (bool) $input['is_visible'] : 1,
                ':status' => $input['status'] ?? 'published',
                ':parent_id' => $itemId
            ]);

            $id = $pdo->lastInsertId();
            $stmt = $pdo->prepare("SELECT * FROM items WHERE id = :id");
            $stmt->execute([':id' => $id]);
            $variant = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $variant]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
}

function handleItemVariant($pdo, $variantId) {
    $method = $_SERVER['REQUEST_METHOD'];
    $variantId = intval($variantId);

    switch ($method) {
        case 'GET':
            $stmt = $pdo->prepare("SELECT * FROM items WHERE id = :id AND parent_id IS NOT NULL");
            $stmt->execute([':id' => $variantId]);
            $variant = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$variant) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Variant not found']);
                return;
            }
            echo json_encode(['success' => true, 'data' => $variant]);
            break;

        case 'PATCH':
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            if (empty($input)) {
                echo json_encode(['success' => false, 'error' => 'No fields to update']);
                return;
            }

            // Check variant exists and is a variant
            $stmt = $pdo->prepare("SELECT * FROM items WHERE id = :id AND parent_id IS NOT NULL");
            $stmt->execute([':id' => $variantId]);
            $variant = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$variant) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Variant not found']);
                return;
            }

            // Only allow updating specific fields, not parent_id
            $fields = [];
            $params = [':id' => $variantId];
            $updatableFields = ['sku', 'name', 'description_short', 'description', 'is_visible', 'status'];
            
            foreach ($updatableFields as $field) {
                if (array_key_exists($field, $input)) {
                    $fields[] = "$field = :$field";
                    $params[":$field"] = $input[$field];
                }
            }
            
            // Handle attributes (for variant_param, diameter, etc.)
            if (array_key_exists('attributes', $input)) {
                $fields[] = "attributes = :attributes";
                $params[':attributes'] = json_encode($input['attributes'], JSON_UNESCAPED_UNICODE);
            }

            if (!$fields) {
                echo json_encode(['success' => false, 'error' => 'No valid fields to update']);
                return;
            }

            $fields[] = "updated_at = CURRENT_TIMESTAMP";
            $sql = "UPDATE items SET " . implode(', ', $fields) . " WHERE id = :id AND parent_id IS NOT NULL";

            try {
                $stmt = $pdo->prepare($sql);
                $result = $stmt->execute($params);
                if ($result === false) {
                    $err = $stmt->errorInfo();
                    error_log("Variant UPDATE failed: " . json_encode($err));
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Database error']);
                    return;
                }
            } catch (Exception $e) {
                error_log("Exception executing variant UPDATE: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Database error', 'message' => $e->getMessage()]);
                return;
            }

            $stmt = $pdo->prepare("SELECT * FROM items WHERE id = :id");
            $stmt->execute([':id' => $variantId]);
            $variant = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $variant]);
            break;

        case 'DELETE':
            $stmt = $pdo->prepare("DELETE FROM items WHERE id = :id AND parent_id IS NOT NULL AND display_only = 0");
            $stmt->execute([':id' => $variantId]);
            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Variant not found or cannot be deleted']);
                return;
            }
            echo json_encode(['success' => true]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
}

function handleItemOptions($pdo, $itemId) {
    $method = $_SERVER['REQUEST_METHOD'];
    $itemId = intval($itemId);

    switch ($method) {
        case 'GET':
            $stmt = $pdo->prepare("SELECT * FROM item_options WHERE item_id = :item_id ORDER BY sort_order, id");
            $stmt->execute([':item_id' => $itemId]);
            $options = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $options]);
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            if (empty($input['option_name'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'option_name is required']);
                return;
            }
            $stmt = $pdo->prepare("
                INSERT INTO item_options (item_id, group_code, group_name, type, option_code, option_name, price_mode, price_value, max_qty, default_on, is_visible, sort_order)
                VALUES (:item_id, :group_code, :group_name, :type, :option_code, :option_name, :price_mode, :price_value, :max_qty, :default_on, :is_visible, :sort_order)
            ");
            $stmt->execute([
                ':item_id' => $itemId,
                ':group_code' => $input['group_code'] ?? null,
                ':group_name' => $input['group_name'] ?? null,
                ':type' => $input['type'] ?? 'checkbox',
                ':option_code' => $input['option_code'] ?? null,
                ':option_name' => $input['option_name'],
                ':price_mode' => $input['price_mode'] ?? 'fixed',
                ':price_value' => isset($input['price_value']) ? $input['price_value'] : null,
                ':max_qty' => isset($input['max_qty']) ? $input['max_qty'] : null,
                ':default_on' => isset($input['default_on']) ? (int) (bool) $input['default_on'] : 0,
                ':is_visible' => isset($input['is_visible']) ? (int) (bool) $input['is_visible'] : 1,
                ':sort_order' => isset($input['sort_order']) ? intval($input['sort_order']) : 0
            ]);
            $id = $pdo->lastInsertId();
            $stmt = $pdo->prepare("SELECT * FROM item_options WHERE id = :id");
            $stmt->execute([':id' => $id]);
            $option = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $option]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
}


function handleSingleProduct($pdo, $productId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Декодируем ID товара (на случай если был encodeURIComponent)
    $productId = urldecode($productId);
    error_log("handleSingleProduct called: METHOD=$method, ID=$productId");
    
    switch ($method) {
        case 'GET':
            // Пробуем найти по ID (число) или по name (строка)
            $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ? OR name = ?");
            $stmt->execute([$productId, $productId]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($product) {
                // Получаем категории товара
                $catStmt = $pdo->prepare("
                    SELECT c.id, c.name, c.slug 
                    FROM categories c
                    INNER JOIN product_category pc ON c.id = pc.category_id
                    WHERE pc.product_id = ?
                ");
                $catStmt->execute([$product['id']]);
                $product['categories'] = $catStmt->fetchAll(PDO::FETCH_ASSOC);
                $product['category_ids'] = array_column($product['categories'], 'id');
                
                // ✅ КРИТИЧНО: Загружаем модификаторы и вариации из product_data
                if (!empty($product['product_data'])) {
                    try {
                        $productData = json_decode($product['product_data'], true);
                        if (is_array($productData)) {
                            $product['modifiers'] = $productData['modifiers'] ?? [];
                            // variations: богатый формат (parameters/quantity)
                            $product['variations'] = $productData['variations'] ?? $productData['variants'] ?? [];
                            // variants: простой формат (name/price/stock) для редактора
                            if (isset($productData['variants'])) {
                                $product['variants'] = $productData['variants'];
                            }
                            $product['related_products'] = $productData['related_products'] ?? [];
                        }
                    } catch (Exception $e) {
                        // Игнорируем ошибки парсинга JSON
                    }
                }
                
                echo json_encode(['success' => true, 'data' => $product]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Product not found', 'searched_id' => $productId]);
            }
            break;
            
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
                return;
            }
            
            // Проверяем существование товара (по ID или name)
            $stmt = $pdo->prepare("SELECT id FROM products WHERE id = ? OR name = ?");
            $stmt->execute([$productId, $productId]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$existing) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Product not found']);
                return;
            }

            // Validate parent/showcase constraints early
            try {
                $desiredParentId = array_key_exists('parent_product_id', $input) ? $input['parent_product_id'] : null;
                $desiredIsShowcase = $input['is_showcase_parent'] ?? $input['display_only'] ?? 0;
                $check = validateProductParentConstraints($pdo, intval($existing['id']), $desiredParentId, $desiredIsShowcase);
                if (!($check['ok'] ?? false)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => $check['error'] ?? 'Invalid parent constraints']);
                    return;
                }
            } catch (Exception $e) {
                // ignore
            }
            
            $updateFields = [];
            $params = [];

            $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
            $columnNames = array_column($columns, 'name');
            $ensureColumn = function($name, $type) use ($pdo, &$columnNames) {
                if (in_array($name, $columnNames, true)) return true;
                try {
                    $pdo->exec("ALTER TABLE products ADD COLUMN $name $type");
                    $columnNames[] = $name;
                    return true;
                } catch (Exception $e) {
                    return false;
                }
            };

            // ✅ Совместимость (по ТЗ): display_only -> is_showcase_parent (+ default skip_inventory)
            if (isset($input['display_only']) && !isset($input['is_showcase_parent'])) {
                $input['is_showcase_parent'] = $input['display_only'] ? 1 : 0;
            }
            if ((isset($input['display_only']) && $input['display_only']) && !isset($input['skip_inventory'])) {
                $input['skip_inventory'] = 1;
            }

            // ✅ Совместимость: parent_sku -> parent_product_id
            if (!isset($input['parent_product_id']) && isset($input['parent_sku']) && $input['parent_sku'] !== '') {
                try {
                    $psku = trim((string)$input['parent_sku']);
                    if ($psku !== '') {
                        $pstmt = $pdo->prepare("SELECT id FROM products WHERE sku = ? LIMIT 1");
                        $pstmt->execute([$psku]);
                        $prow = $pstmt->fetch(PDO::FETCH_ASSOC);
                        if ($prow && isset($prow['id'])) {
                            $input['parent_product_id'] = intval($prow['id']);
                        }
                    }
                } catch (Exception $e) {
                    // ignore
                }
            }
            
            if (isset($input['name']) && $ensureColumn('name', 'TEXT')) {
                $updateFields[] = "name = ?";
                $params[] = $input['name'];
            }
            if (isset($input['description']) && $ensureColumn('description', 'TEXT')) {
                $updateFields[] = "description = ?";
                $params[] = $input['description'];
            }
            if (isset($input['price']) && $ensureColumn('price', 'REAL')) {
                $updateFields[] = "price = ?";
                $params[] = $input['price'];
            }
            if (isset($input['category']) && $ensureColumn('category', 'TEXT')) {
                $updateFields[] = "category = ?";
                $params[] = $input['category'];
            }
            if ((isset($input['image_url']) || isset($input['picture']) || isset($input['image'])) && $ensureColumn('image_url', 'TEXT')) {
                $image_url = $input['image_url'] ?? $input['picture'] ?? $input['image'] ?? '';
                $updateFields[] = "image_url = ?";
                $params[] = $image_url;
            }
            if (isset($input['available']) && $ensureColumn('available', 'INTEGER')) {
                $updateFields[] = "available = ?";
                $params[] = $input['available'] ? 1 : 0;
            }
            if (isset($input['visible_on_site']) && $ensureColumn('visible_on_site', 'INTEGER')) {
                $updateFields[] = "visible_on_site = ?";
                $params[] = $input['visible_on_site'] ? 1 : 0;
            }
            if (isset($input['sku']) && $ensureColumn('sku', 'TEXT')) {
                $updateFields[] = "sku = ?";
                $params[] = $input['sku'];
            }
            if (isset($input['weight']) && $ensureColumn('weight', 'REAL')) {
                $updateFields[] = "weight = ?";
                $params[] = $input['weight'];
            }
            if (isset($input['calories']) && $ensureColumn('calories', 'REAL')) {
                $updateFields[] = "calories = ?";
                $params[] = $input['calories'];
            }
            if (isset($input['type']) && $ensureColumn('type', 'TEXT')) {
                $updateFields[] = "type = ?";
                $params[] = $input['type'];
            }
            if (isset($input['group_id']) && $ensureColumn('group_id', 'INTEGER')) {
                $updateFields[] = "group_id = ?";
                $params[] = $input['group_id'];
            }
            if (isset($input['category_stock']) && $ensureColumn('category_stock', 'INTEGER')) {
                $updateFields[] = "category_stock = ?";
                $params[] = $input['category_stock'];
            }
            if (isset($input['cost']) && $ensureColumn('cost', 'REAL')) {
                $updateFields[] = "cost = ?";
                $params[] = $input['cost'];
            }
            if (isset($input['old_price']) && $ensureColumn('old_price', 'REAL')) {
                $updateFields[] = "old_price = ?";
                $params[] = $input['old_price'];
            }
            if (isset($input['short_description']) && $ensureColumn('short_description', 'TEXT')) {
                $updateFields[] = "short_description = ?";
                $params[] = $input['short_description'];
            }
            if (isset($input['full_description']) && $ensureColumn('full_description', 'TEXT')) {
                $updateFields[] = "full_description = ?";
                $params[] = $input['full_description'];
            }
            if (isset($input['ingredients']) && $ensureColumn('ingredients', 'TEXT')) {
                $updateFields[] = "ingredients = ?";
                $params[] = $input['ingredients'];
            }
            if (isset($input['allergens']) && $ensureColumn('allergens', 'TEXT')) {
                $updateFields[] = "allergens = ?";
                $params[] = $input['allergens'];
            }
            if (isset($input['stock_quantity']) && $ensureColumn('stock_quantity', 'INTEGER')) {
                $updateFields[] = "stock_quantity = ?";
                $params[] = $input['stock_quantity'];
            }
            if (isset($input['quantity']) && $ensureColumn('quantity', 'INTEGER')) {
                $updateFields[] = "quantity = ?";
                $params[] = $input['quantity'];
            }
            if (isset($input['hidden_for_promo']) && $ensureColumn('hidden_for_promo', 'INTEGER')) {
                $updateFields[] = "hidden_for_promo = ?";
                $params[] = $input['hidden_for_promo'] ? 1 : 0;
            }
            if (isset($input['loss_percentage']) && $ensureColumn('loss_percentage', 'REAL')) {
                $updateFields[] = "loss_percentage = ?";
                $params[] = floatval($input['loss_percentage']);
            }
            if (isset($input['conversion_factor']) && $ensureColumn('conversion_factor', 'REAL')) {
                $updateFields[] = "conversion_factor = ?";
                $params[] = floatval($input['conversion_factor']);
            }
            if (isset($input['vat_rate'])) {
                // Валидация НДС через parseVATRate
                $vatRate = parseVATRate($input['vat_rate']);
                if ($vatRate !== null) {
                    if ($ensureColumn('vat_rate', 'REAL')) {
                        $updateFields[] = "vat_rate = ?";
                        $params[] = $vatRate;
                    }
                }
            }
            if (isset($input['tax_type']) && in_array($input['tax_type'], ['alcohol', 'excise', 'none'])) {
                if ($ensureColumn('tax_type', 'TEXT')) {
                    $updateFields[] = "tax_type = ?";
                    $params[] = $input['tax_type'];
                }
            }
            if (isset($input['parent_product_id']) && $ensureColumn('parent_product_id', 'INTEGER')) {
                $updateFields[] = "parent_product_id = ?";
                $params[] = $input['parent_product_id'];
            }

            if (isset($input['is_showcase_parent']) && $ensureColumn('is_showcase_parent', 'INTEGER')) {
                $updateFields[] = "is_showcase_parent = ?";
                $params[] = $input['is_showcase_parent'] ? 1 : 0;
            }

            if (isset($input['skip_inventory']) && $ensureColumn('skip_inventory', 'INTEGER')) {
                $updateFields[] = "skip_inventory = ?";
                $params[] = $input['skip_inventory'] ? 1 : 0;
            }

            if (isset($input['display_only']) && $ensureColumn('display_only', 'INTEGER')) {
                $updateFields[] = "display_only = ?";
                $params[] = $input['display_only'] ? 1 : 0;
            }

            if (isset($input['parent_sku']) && $ensureColumn('parent_sku', 'TEXT')) {
                $updateFields[] = "parent_sku = ?";
                $params[] = $input['parent_sku'];
            }
            
            // ✅ КРИТИЧНО: Обработка модификаторов и вариаций - сохраняем в JSON поле
            $productDataJson = [];
            
            // Сохраняем модификаторы, если переданы
            if (isset($input['modifiers'])) {
                $modifiers = is_string($input['modifiers']) ? json_decode($input['modifiers'], true) : $input['modifiers'];
                if (is_array($modifiers)) {
                    $productDataJson['modifiers'] = $modifiers;
                }
            }
            
            // Сохраняем вариации, если переданы
            // - variants: простой формат (name/price/stock) для редактора
            // - variations: богатый формат (variant_id/price/quantity/parameters) для витрины
            $variantsSimple = null;
            if (isset($input['variants'])) {
                $variantsSimple = is_string($input['variants']) ? json_decode($input['variants'], true) : $input['variants'];
                if (is_array($variantsSimple)) {
                    $productDataJson['variants'] = $variantsSimple;
                }
            }

            if (isset($input['variations'])) {
                $variationsRich = is_string($input['variations']) ? json_decode($input['variations'], true) : $input['variations'];
                if (is_array($variationsRich)) {
                    $productDataJson['variations'] = $variationsRich;
                }
            } elseif (is_array($variantsSimple)) {
                // ✅ ИСПРАВЛЕНО: Если пришли только простые variants — генерируем rich variations автоматически
                $generated = [];
                $idx = 0;
                foreach ($variantsSimple as $v) {
                    if (!is_array($v)) continue;
                    $name = $v['name'] ?? $v['title'] ?? null;
                    if (!$name) continue;
                    $price = isset($v['price']) ? floatval($v['price']) : 0.0;
                    $stock = isset($v['stock']) ? intval($v['stock']) : (isset($v['quantity']) ? intval($v['quantity']) : 0);
                    
                    // ✅ КРИТИЧНО: Извлекаем размер из имени (например, "25 см" -> 25)
                    $sizeValue = 25;
                    if (preg_match('/(\d+)\s*(см|cm|см\.?)/i', $name, $matches)) {
                        $sizeValue = intval($matches[1]);
                    } elseif (preg_match('/^(\d+)$/', $name, $matches)) {
                        $sizeValue = intval($matches[1]);
                    }
                    
                    $generated[] = [
                        'variant_id' => $v['variant_id'] ?? ('var-' . time() . '-' . $idx),
                        'price' => $price,
                        'quantity' => $stock,
                        'size' => $sizeValue, // ✅ Добавляем размер напрямую
                        'parameters' => [
                            ['name' => 'Размер', 'value' => $sizeValue . ' см', 'display' => 'list'],
                            ['name' => 'Вариант', 'value' => $name, 'display' => 'list']
                        ]
                    ];
                    $idx++;
                }
                if (!empty($generated)) {
                    $productDataJson['variations'] = $generated;
                }
            }
            
            // Сохраняем рекомендуемые товары
            if (isset($input['recommended_products'])) {
                $recommended = is_string($input['recommended_products']) ? json_decode($input['recommended_products'], true) : $input['recommended_products'];
                if (is_array($recommended)) {
                    $productDataJson['related_products'] = $recommended;
                }
            }
            
            // Сохраняем JSON данные в поле product_data (создаем колонку если нужно)
            if (!empty($productDataJson)) {
                try {
                    $pdo->exec("ALTER TABLE products ADD COLUMN product_data TEXT");
                } catch (Exception $e) {
                    // Колонка уже существует - это нормально
                }
                
                // Получаем существующие данные
                $existingData = [];
                try {
                    $dataStmt = $pdo->prepare("SELECT product_data FROM products WHERE id = ?");
                    $dataStmt->execute([$existing['id']]);
                    $dataRow = $dataStmt->fetch(PDO::FETCH_ASSOC);
                    if ($dataRow && !empty($dataRow['product_data'])) {
                        $existingData = json_decode($dataRow['product_data'], true) ?: [];
                    }
                } catch (Exception $e) {
                    // Игнорируем ошибки
                }
                
                // Объединяем с существующими данными
                $mergedData = array_merge($existingData, $productDataJson);
                $updateFields[] = "product_data = ?";
                $params[] = json_encode($mergedData, JSON_UNESCAPED_UNICODE);
            }
            
            // Обработка категорий (many-to-many)
            if (isset($input['category_ids']) && is_array($input['category_ids'])) {
                // Удаляем старые связи
                $pdo->prepare("DELETE FROM product_category WHERE product_id = ?")->execute([$existing['id']]);
                // Добавляем новые связи
                $catStmt = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
                foreach ($input['category_ids'] as $catId) {
                    $catStmt->execute([$existing['id'], $catId]);
                }
            }
            
            if (empty($updateFields)) {
                // Если нет полей для обновления, но есть category_ids - это нормально
                if (!isset($input['category_ids'])) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'No fields to update']);
                    return;
                }
            }
            
            if (!empty($updateFields)) {
                $params[] = $existing['id'];
                $sql = "UPDATE products SET " . implode(', ', $updateFields) . " WHERE id = ?";

                // Ensure params are safe for binding: JSON-encode arrays/objects
                foreach ($params as $pi => $pv) {
                    if (is_array($pv) || is_object($pv)) {
                        $params[$pi] = json_encode($pv, JSON_UNESCAPED_UNICODE);
                    }
                }

                // Fix: Ensure number of params matches number of placeholders
                $numPlaceholders = substr_count($sql, '?');
                if (count($params) !== $numPlaceholders) {
                    $logMsg = "[API ERROR] SQL placeholder/param mismatch: placeholders=$numPlaceholders, params=" . count($params) . "\nSQL: $sql\nPARAMS: " . json_encode($params);
                    $logFile = __DIR__ . '/../logs/api-error.log';
                    $logDir = dirname($logFile);
                    if (!is_dir($logDir)) {
                        @mkdir($logDir, 0777, true);
                    }
                    @file_put_contents($logFile, $logMsg . "\n", FILE_APPEND);
                    error_log($logMsg);
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Internal error: parameter mismatch', 'sql' => $sql, 'params' => $params]);
                    return;
                }

                // Log the SQL query and parameters before execution
                $logMsg = "[API SQL] Executing: $sql\nPARAMS: " . json_encode($params);
                $logFile = __DIR__ . '/../logs/api-error.log';
                $logDir = dirname($logFile);
                if (!is_dir($logDir)) {
                    @mkdir($logDir, 0777, true);
                }
                @file_put_contents($logFile, $logMsg . "\n", FILE_APPEND);
                error_log($logMsg);

                try {
                    $stmt = $pdo->prepare($sql);
                    $result = $stmt->execute($params);
                    if ($result === false) {
                        $err = $stmt->errorInfo();
                        $logMsg = "[API ERROR] Product UPDATE failed: " . json_encode($err) . "\nSQL: $sql\nPARAMS: " . json_encode($params);
                        @file_put_contents($logFile, $logMsg . "\n", FILE_APPEND);
                        error_log($logMsg);
                    }
                } catch (Exception $e) {
                    $logMsg = "[API EXCEPTION] " . $e->getMessage() . "\nSQL: $sql\nPARAMS: " . json_encode($params);
                    @file_put_contents($logFile, $logMsg . "\n", FILE_APPEND);
                    error_log($logMsg);
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Database error', 'message' => $e->getMessage()]);
                    return;
                }
            } else {
                $result = true; // Если обновлялись только категории
            }
            
            if ($result) {
                // Возвращаем обновленный товар с категориями
                $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ?");
                $stmt->execute([$existing['id']]);
                $product = $stmt->fetch(PDO::FETCH_ASSOC);
                
                // Добавляем категории товара
                if ($product) {
                    try {
                        $catStmt = $pdo->prepare("
                            SELECT c.id, c.name, c.slug 
                            FROM categories c
                            INNER JOIN product_category pc ON c.id = pc.category_id
                            WHERE pc.product_id = ?
                        ");
                        $catStmt->execute([$product['id']]);
                        $product['categories'] = $catStmt->fetchAll(PDO::FETCH_ASSOC);
                        $product['category_ids'] = array_column($product['categories'], 'id');
                    } catch (Exception $e) {
                        error_log("Error loading categories after update: " . $e->getMessage());
                        $product['categories'] = [];
                        $product['category_ids'] = [];
                    }
                    
                    // ✅ КРИТИЧНО: Загружаем модификаторы и вариации из product_data после обновления
                    if (!empty($product['product_data'])) {
                        try {
                            $productData = json_decode($product['product_data'], true);
                            if (is_array($productData)) {
                                $product['modifiers'] = $productData['modifiers'] ?? [];
                                $product['variations'] = $productData['variations'] ?? $productData['variants'] ?? [];
                                $product['related_products'] = $productData['related_products'] ?? [];
                            }
                        } catch (Exception $e) {
                            // Игнорируем ошибки парсинга JSON
                        }
                    }
                }
                
                echo json_encode(['success' => true, 'data' => $product]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to update product']);
            }
            break;
            
        case 'DELETE':
            error_log("DELETE request for product ID: $productId (type: " . gettype($productId) . ")");
            
            // Преобразуем ID в число, если это возможно
            $numericId = is_numeric($productId) ? intval($productId) : null;
            
            // Пробуем найти товар разными способами:
            // 1. По числовому ID (основной способ) - пробуем и числовой и строковый вариант
            // 2. По строковому ID в поле name
            // 3. По SKU
            $product = null;
            
            if ($numericId !== null) {
                // Пробуем найти по числовому ID
                $stmt = $pdo->prepare("SELECT id, name FROM products WHERE id = ?");
                $stmt->execute([$numericId]);
                $product = $stmt->fetch(PDO::FETCH_ASSOC);
                
                // Если не нашли, пробуем найти по строковому ID (на случай если в БД ID хранится как строка)
                if (!$product) {
                    $stmt = $pdo->prepare("SELECT id, name FROM products WHERE CAST(id AS TEXT) = ?");
                    $stmt->execute([$productId]);
                    $product = $stmt->fetch(PDO::FETCH_ASSOC);
                }
            }
            
            // Если все еще не нашли, пробуем найти по name или sku
            if (!$product) {
                $stmt = $pdo->prepare("SELECT id, name FROM products WHERE name = ? OR sku = ? LIMIT 1");
                $stmt->execute([$productId, $productId]);
                $product = $stmt->fetch(PDO::FETCH_ASSOC);
            }
            
            if (!$product) {
                error_log("Product not found: ID=$productId (numeric: " . ($numericId ?? 'N/A') . ")");
                // Проверяем все товары для отладки
                $allProducts = $pdo->query("SELECT id, name, sku FROM products LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
                error_log("Sample products: " . json_encode($allProducts));
                
                // Если товар не найден, возвращаем success: true с сообщением
                // (товар может существовать только локально или уже быть удален)
                http_response_code(200);
                echo json_encode([
                    'success' => true, 
                    'message' => 'Product not found in database (may exist only locally)',
                    'searched_id' => $productId,
                    'note' => 'Product deletion handled by frontend'
                ]);
                return;
            }

            try {
                $cols = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
                $cn = array_column($cols, 'name');
                $hasParentCol = in_array('parent_product_id', $cn, true);
                $hasVisibleOnSite = in_array('visible_on_site', $cn, true);
                $hasParentSku = in_array('parent_sku', $cn, true);
                $hasIsShowcaseParent = in_array('is_showcase_parent', $cn, true);
                $hasDisplayOnly = in_array('display_only', $cn, true);

                if ($hasParentCol) {
                    $pstmt = $pdo->prepare("SELECT id, parent_product_id, is_showcase_parent, display_only FROM products WHERE id = ? LIMIT 1");
                    $pstmt->execute([$product['id']]);
                    $pRow = $pstmt->fetch(PDO::FETCH_ASSOC);

                    $isVariant = $pRow && ($pRow['parent_product_id'] ?? null) !== null;
                    if ($isVariant) {
                        $info = countActiveOrdersUsingProduct($pdo, intval($product['id']));
                        if (($info['count'] ?? 0) > 0) {
                            http_response_code(409);
                            echo json_encode([
                                'success' => false,
                                'error' => 'Variant is used in active orders',
                                'active_orders_count' => $info['count'],
                                'active_order_ids' => $info['order_ids']
                            ]);
                            return;
                        }
                    }

                    $isShowcaseParent = false;
                    if ($hasIsShowcaseParent && $pRow && intval($pRow['is_showcase_parent'] ?? 0) === 1) $isShowcaseParent = true;
                    if ($hasDisplayOnly && $pRow && intval($pRow['display_only'] ?? 0) === 1) $isShowcaseParent = true;

                    if ($isShowcaseParent) {
                        $cstmt = $pdo->prepare("SELECT id FROM products WHERE parent_product_id = ? ORDER BY id");
                        $cstmt->execute([$product['id']]);
                        $children = $cstmt->fetchAll(PDO::FETCH_ASSOC);

                        if (is_array($children) && count($children) > 0) {
                            $blockedCount = 0;
                            $blockedOrderIds = [];
                            foreach ($children as $ch) {
                                $cid = intval($ch['id'] ?? 0);
                                if ($cid <= 0) continue;
                                $info = countActiveOrdersUsingProduct($pdo, $cid);
                                if (($info['count'] ?? 0) > 0) {
                                    $blockedCount += ($info['count'] ?? 0);
                                    $blockedOrderIds = array_values(array_unique(array_merge($blockedOrderIds, $info['order_ids'] ?? [])));
                                }
                            }

                            if ($blockedCount > 0) {
                                http_response_code(409);
                                echo json_encode([
                                    'success' => false,
                                    'error' => 'Cannot delete parent: variants are used in active orders',
                                    'active_orders_count' => $blockedCount,
                                    'active_order_ids' => array_slice($blockedOrderIds, 0, 50)
                                ]);
                                return;
                            }

                            $setParts = ["parent_product_id = NULL"]; 
                            if ($hasParentSku) {
                                $setParts[] = "parent_sku = NULL";
                            }
                            if ($hasVisibleOnSite) {
                                $setParts[] = "visible_on_site = 0";
                            }

                            $sqlDetach = "UPDATE products SET " . implode(', ', $setParts) . " WHERE parent_product_id = ?";
                            $pdo->prepare($sqlDetach)->execute([$product['id']]);
                        }
                    }
                }
            } catch (Exception $e) {
                // ignore
            }
            
            // Удаляем товар по числовому ID
            // Сначала удаляем связи с категориями (CASCADE должно работать, но на всякий случай)
            $pdo->prepare("DELETE FROM product_category WHERE product_id = ?")->execute([$product['id']]);
            
            // Затем удаляем сам товар
            $stmt = $pdo->prepare("DELETE FROM products WHERE id = ?");
            $result = $stmt->execute([$product['id']]);
            
            if ($result) {
                // Также очищаем старые синхронизированные данные, чтобы удаленные товары не восстанавливались
                // Это гарантирует, что /api/products/sync не вернет удаленные товары
                try {
                    $pdo->exec("DELETE FROM synced_products");
                    error_log("Cleared synced_products table after product deletion");
                } catch (Exception $e) {
                    // Игнорируем ошибку, если таблица не существует
                    error_log("Note: Could not clear synced_products: " . $e->getMessage());
                }
                
                error_log("Product deleted successfully: DB_ID=" . $product['id'] . ", Name=" . $product['name']);
                echo json_encode([
                    'success' => true, 
                    'message' => 'Product deleted',
                    'deleted_id' => $product['id'],
                    'deleted_name' => $product['name']
                ]);
            } else {
                error_log("Failed to delete product: DB_ID=" . $product['id']);
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to delete product']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleCategories($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            try {
                // Проверяем существование таблицы categories
                $tableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'");
                if ($tableCheck->fetchColumn() === false) {
                    // Таблица не существует - создаем пустой ответ
                    echo json_encode(['success' => true, 'data' => []]);
                    return;
                }
                
                // Поддержка фильтрации
                $showOnSite = isset($_GET['show_on_site']) ? $_GET['show_on_site'] : null;
                $showInNav = isset($_GET['show_in_nav']) ? $_GET['show_in_nav'] : null;
                $parentId = isset($_GET['parent_id']) ? $_GET['parent_id'] : null;
                $type = isset($_GET['type']) ? $_GET['type'] : null; // Фильтр по типу (menu/stock)
                $search = isset($_GET['search']) ? $_GET['search'] : null;
                
                // Проверяем наличие колонок перед использованием
                $columnsCheck = $pdo->query("PRAGMA table_info(categories)");
                $columns = $columnsCheck->fetchAll(PDO::FETCH_ASSOC);
                $columnNames = array_column($columns, 'name');
                
                $hasShowOnSite = in_array('show_on_site', $columnNames);
                $hasShowInNav = in_array('show_in_nav', $columnNames);
                $hasShowInProductCard = in_array('show_in_product_card', $columnNames);
                $hasParentId = in_array('parent_id', $columnNames);
                $hasType = in_array('type', $columnNames);
                $hasPosition = in_array('position', $columnNames);
                $hasSortOrder = in_array('sort_order', $columnNames);
                
                $sql = "SELECT c.*";
                
                // Добавляем product_count только если таблица product_category существует
                $productCatCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='product_category'");
                if ($productCatCheck->fetchColumn() !== false) {
                    $sql .= ", (SELECT COUNT(*) FROM product_category WHERE category_id = c.id) as product_count";
                } else {
                    $sql .= ", 0 as product_count";
                }
                
                // Добавляем parent_name только если есть parent_id
                if ($hasParentId) {
                    $sql .= ", (SELECT name FROM categories WHERE id = c.parent_id) as parent_name";
                } else {
                    $sql .= ", NULL as parent_name";
                }
                
                $sql .= " FROM categories c WHERE 1=1";
                $params = [];
                
                if ($hasShowOnSite && $showOnSite !== null) {
                    $sql .= " AND c.show_on_site = ?";
                    $params[] = $showOnSite ? 1 : 0;
                }
                if ($hasShowInNav && $showInNav !== null) {
                    $sql .= " AND c.show_in_nav = ?";
                    $params[] = $showInNav ? 1 : 0;
                }
                if ($hasParentId && $parentId !== null) {
                    $sql .= " AND c.parent_id = ?";
                    $params[] = $parentId;
                }
                if ($hasType && $type !== null && in_array($type, ['menu', 'stock'])) {
                    $sql .= " AND c.type = ?";
                    $params[] = $type;
                }
                if ($search) {
                    $sql .= " AND (c.name LIKE ? OR c.slug LIKE ?)";
                    $searchTerm = "%$search%";
                    $params[] = $searchTerm;
                    $params[] = $searchTerm;
                }
                
                // Безопасная сортировка
                if ($hasPosition) {
                    $sql .= " ORDER BY COALESCE(c.position, 0) ASC, c.name ASC";
                } elseif ($hasSortOrder) {
                    $sql .= " ORDER BY COALESCE(c.sort_order, 0) ASC, c.name ASC";
                } else {
                    $sql .= " ORDER BY c.name ASC";
                }
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Преобразуем boolean значения для совместимости
                foreach ($categories as &$cat) {
                    if (isset($cat['show_on_site'])) {
                        $cat['show_on_site'] = (bool)$cat['show_on_site'];
                    }
                    if (isset($cat['show_in_nav'])) {
                        $cat['show_in_nav'] = (bool)$cat['show_in_nav'];
                    }
                    if ($hasShowInProductCard && isset($cat['show_in_product_card'])) {
                        $cat['show_in_product_card'] = (bool)$cat['show_in_product_card'];
                    }
                }
                
                echo json_encode(['success' => true, 'data' => $categories]);
            } catch (Exception $e) {
                error_log("Error in handleCategories GET: " . $e->getMessage());
                error_log("Stack trace: " . $e->getTraceAsString());
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage()
                ]);
            }
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (empty($input['name'])) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Name is required']);
                    return;
                }
                
                $name = $input['name'];
                $slug = $input['slug'] ?? strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', trim($name)));
                $slug = trim($slug, '-');
                $parentId = isset($input['parent_id']) && $input['parent_id'] ? intval($input['parent_id']) : null;
                $type = isset($input['type']) && in_array($input['type'], ['menu', 'stock']) ? $input['type'] : 'menu';
                $description = $input['description'] ?? null;
                $imageUrl = $input['image_url'] ?? null;
                $seoTitle = $input['seo_title'] ?? null;
                $seoDescription = $input['seo_description'] ?? null;
                $seoKeywords = $input['seo_keywords'] ?? null;
                $position = isset($input['position']) ? intval($input['position']) : (isset($input['sort_order']) ? intval($input['sort_order']) : 0);
                $showOnSite = isset($input['show_on_site']) ? ($input['show_on_site'] ? 1 : 0) : 1;
                $showInNav = isset($input['show_in_nav']) ? ($input['show_in_nav'] ? 1 : 0) : 1;
                $showInProductCard = isset($input['show_in_product_card']) ? ($input['show_in_product_card'] ? 1 : 0) : 1;
                
                // ✅ ИСПРАВЛЕНО: Проверка на циклические связи и существование родительской категории
                if ($parentId) {
                    $checkCycle = $pdo->prepare("SELECT id, parent_id FROM categories WHERE id = ?");
                    $checkCycle->execute([$parentId]);
                    $parent = $checkCycle->fetch(PDO::FETCH_ASSOC);
                    if (!$parent) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'error' => 'Родительская категория не найдена']);
                        return;
                    }
                    // Проверяем, не создаем ли мы циклическую ссылку (если родитель уже является потомком этой категории)
                    // Это проверяется при обновлении, но для создания тоже нужно проверить
                }
                
                // Проверяем уникальность slug
                $checkStmt = $pdo->prepare("SELECT id FROM categories WHERE slug = ?");
                $checkStmt->execute([$slug]);
                if ($checkStmt->fetch()) {
                    $counter = 1;
                    $originalSlug = $slug;
                    do {
                        $slug = $originalSlug . '-' . $counter;
                        $checkStmt->execute([$slug]);
                        $counter++;
                    } while ($checkStmt->fetch());
                }
                
                // Проверяем наличие колонок перед вставкой
                $columnsCheck = $pdo->query("PRAGMA table_info(categories)");
                $columns = $columnsCheck->fetchAll(PDO::FETCH_ASSOC);
                $columnNames = array_column($columns, 'name');
                
                // Формируем список полей и значений динамически
                $fields = ['name', 'slug'];
                $values = [$name, $slug];
                $placeholders = ['?', '?'];
                
                if (in_array('parent_id', $columnNames)) {
                    $fields[] = 'parent_id';
                    $values[] = $parentId;
                    $placeholders[] = '?';
                }
                if (in_array('type', $columnNames)) {
                    $fields[] = 'type';
                    $values[] = $type;
                    $placeholders[] = '?';
                }
                if (in_array('description', $columnNames)) {
                    $fields[] = 'description';
                    $values[] = $description;
                    $placeholders[] = '?';
                }
                if (in_array('image_url', $columnNames)) {
                    $fields[] = 'image_url';
                    $values[] = $imageUrl;
                    $placeholders[] = '?';
                }
                if (in_array('seo_title', $columnNames)) {
                    $fields[] = 'seo_title';
                    $values[] = $seoTitle;
                    $placeholders[] = '?';
                }
                if (in_array('seo_description', $columnNames)) {
                    $fields[] = 'seo_description';
                    $values[] = $seoDescription;
                    $placeholders[] = '?';
                }
                if (in_array('seo_keywords', $columnNames)) {
                    $fields[] = 'seo_keywords';
                    $values[] = $seoKeywords;
                    $placeholders[] = '?';
                }
                if (in_array('position', $columnNames)) {
                    $fields[] = 'position';
                    $values[] = $position;
                    $placeholders[] = '?';
                } elseif (in_array('sort_order', $columnNames)) {
                    $fields[] = 'sort_order';
                    $values[] = $position;
                    $placeholders[] = '?';
                }
                if (in_array('show_on_site', $columnNames)) {
                    $fields[] = 'show_on_site';
                    $values[] = $showOnSite;
                    $placeholders[] = '?';
                }
                if (in_array('show_in_nav', $columnNames)) {
                    $fields[] = 'show_in_nav';
                    $values[] = $showInNav;
                    $placeholders[] = '?';
                }
                if (in_array('show_in_product_card', $columnNames)) {
                    $fields[] = 'show_in_product_card';
                    $values[] = $showInProductCard;
                    $placeholders[] = '?';
                }
                
                $sql = "INSERT INTO categories (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $placeholders) . ")";
                $stmt = $pdo->prepare($sql);
                
                $result = $stmt->execute($values);
                
                if (!$result) {
                    $errorInfo = $stmt->errorInfo();
                    throw new Exception('Failed to insert category: ' . ($errorInfo[2] ?? 'Unknown error'));
                }
                
                $newId = $pdo->lastInsertId();
                
                // Создаем запись в menu_sections по умолчанию, если таблица существует
                try {
                    $menuTableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='menu_sections'");
                    if ($menuTableCheck->fetchColumn() !== false) {
                        $menuStmt = $pdo->prepare("INSERT OR IGNORE INTO menu_sections (category_id) VALUES (?)");
                        $menuStmt->execute([$newId]);
                    }
                } catch (Exception $e) {
                    error_log("Warning: Could not create menu_section for category $newId: " . $e->getMessage());
                }
                
                // Возвращаем созданную категорию
                $stmt = $pdo->prepare("SELECT * FROM categories WHERE id = ?");
                $stmt->execute([$newId]);
                $category = $stmt->fetch(PDO::FETCH_ASSOC);
                
                // Добавляем product_count
                $productCatCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='product_category'");
                if ($productCatCheck->fetchColumn() !== false) {
                    $countStmt = $pdo->prepare("SELECT COUNT(*) as count FROM product_category WHERE category_id = ?");
                    $countStmt->execute([$newId]);
                    $count = $countStmt->fetch(PDO::FETCH_ASSOC);
                    $category['product_count'] = $count['count'];
                } else {
                    $category['product_count'] = 0;
                }
                
                // Преобразуем boolean значения
                if (isset($category['show_on_site'])) {
                    $category['show_on_site'] = (bool)$category['show_on_site'];
                }
                if (isset($category['show_in_nav'])) {
                    $category['show_in_nav'] = (bool)$category['show_in_nav'];
                }
                
                echo json_encode([
                    'success' => true,
                    'id' => $newId,
                    'data' => $category,
                    'message' => 'Category created successfully'
                ]);
            } catch (Exception $e) {
                error_log("Error creating category: " . $e->getMessage());
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage()
                ]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

/**
 * Handle category products (GET /categories/{id}/products)
 */
function handleCategoryProducts($pdo, $categoryId) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT p.* FROM products p
            INNER JOIN product_category pc ON p.id = pc.product_id
            WHERE pc.category_id = ? AND p.visible_on_site = 1
            ORDER BY p.name
        ");
        $stmt->execute([$categoryId]);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'data' => $products]);
    } catch (Exception $e) {
        error_log("Error fetching category products: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Handle product categories (POST/DELETE /products/{id}/categories)
 */
function handleProductCategories($pdo, $productId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!isset($input['category_ids']) || !is_array($input['category_ids'])) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'category_ids array is required']);
                    return;
                }
                
                // Удаляем старые привязки
                $stmt = $pdo->prepare("DELETE FROM product_category WHERE product_id = ?");
                $stmt->execute([$productId]);
                
                // Добавляем новые привязки
                $stmt = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
                foreach ($input['category_ids'] as $categoryId) {
                    $stmt->execute([$productId, $categoryId]);
                }
                
                echo json_encode(['success' => true, 'message' => 'Product categories updated']);
            } catch (Exception $e) {
                error_log("Error updating product categories: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        case 'DELETE':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                $categoryId = $input['category_id'] ?? null;
                
                if (!$categoryId) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'category_id is required']);
                    return;
                }
                
                $stmt = $pdo->prepare("DELETE FROM product_category WHERE product_id = ? AND category_id = ?");
                $stmt->execute([$productId, $categoryId]);
                
                echo json_encode(['success' => true, 'message' => 'Category link removed']);
            } catch (Exception $e) {
                error_log("Error removing product category: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

/**
 * Handle categories reorder (POST /categories/reorder)
 */
function handleCategoriesReorder($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        return;
    }
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['categories']) || !is_array($input['categories'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'categories array is required']);
            return;
        }
        
        // Проверяем наличие колонки updated_at
        $columnsCheck = $pdo->query("PRAGMA table_info(categories)");
        $columns = $columnsCheck->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_column($columns, 'name');
        $hasUpdatedAt = in_array('updated_at', $columnNames);
        
        // Если колонки нет, добавляем её
        if (!$hasUpdatedAt) {
            try {
                $pdo->exec("ALTER TABLE categories ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
                error_log("Migration: Added 'updated_at' column to categories table");
                $hasUpdatedAt = true;
            } catch (Exception $e) {
                error_log("Warning: Could not add updated_at column: " . $e->getMessage());
            }
        }
        
        // Проверяем наличие колонки position
        $hasPosition = in_array('position', $columnNames);
        if (!$hasPosition) {
            try {
                $pdo->exec("ALTER TABLE categories ADD COLUMN position INTEGER DEFAULT 0");
                error_log("Migration: Added 'position' column to categories table");
                $hasPosition = true;
            } catch (Exception $e) {
                error_log("Warning: Could not add position column: " . $e->getMessage());
            }
        }
        
        // Формируем SQL запрос в зависимости от наличия колонок
        $updateFields = ['position = ?'];
        if ($hasUpdatedAt) {
            $updateFields[] = 'updated_at = CURRENT_TIMESTAMP';
        }
        $sql = "UPDATE categories SET " . implode(', ', $updateFields) . " WHERE id = ?";
        
        $stmt = $pdo->prepare($sql);
        
        // Начинаем транзакцию ПЕРЕД выполнением запросов
        $pdo->beginTransaction();
        
        try {
            foreach ($input['categories'] as $index => $category) {
                $categoryId = is_array($category) ? $category['id'] : $category;
                if ($hasUpdatedAt) {
                    $stmt->execute([$index, $categoryId]);
                } else {
                    // Если нет updated_at, используем только position
                    $stmtSimple = $pdo->prepare("UPDATE categories SET position = ? WHERE id = ?");
                    $stmtSimple->execute([$index, $categoryId]);
                }
            }
            
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Categories reordered']);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    } catch (Exception $e) {
        error_log("Error reordering categories: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Handle categories bulk operations (POST /categories/bulk)
 */
function handleCategoriesBulk($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        return;
    }
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['action']) || !isset($input['category_ids']) || !is_array($input['category_ids'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'action and category_ids are required']);
            return;
        }
        
        // Проверяем наличие колонки updated_at
        $columnsCheck = $pdo->query("PRAGMA table_info(categories)");
        $columns = $columnsCheck->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_column($columns, 'name');
        $hasUpdatedAt = in_array('updated_at', $columnNames);
        
        // Если колонки нет, добавляем её
        if (!$hasUpdatedAt) {
            try {
                $pdo->exec("ALTER TABLE categories ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
                error_log("Migration: Added 'updated_at' column to categories table in handleCategoriesBulk");
                $hasUpdatedAt = true;
            } catch (Exception $e) {
                error_log("Warning: Could not add updated_at column: " . $e->getMessage());
            }
        }
        
        $action = $input['action'];
        $categoryIds = $input['category_ids'];
        $placeholders = implode(',', array_fill(0, count($categoryIds), '?'));
        
        $pdo->beginTransaction();
        
        switch ($action) {
            case 'show_on_site':
                if ($hasUpdatedAt) {
                    $stmt = $pdo->prepare("UPDATE categories SET show_on_site = 1, updated_at = CURRENT_TIMESTAMP WHERE id IN ($placeholders)");
                } else {
                    $stmt = $pdo->prepare("UPDATE categories SET show_on_site = 1 WHERE id IN ($placeholders)");
                }
                $stmt->execute($categoryIds);
                break;
                
            case 'hide_on_site':
                if ($hasUpdatedAt) {
                    $stmt = $pdo->prepare("UPDATE categories SET show_on_site = 0, updated_at = CURRENT_TIMESTAMP WHERE id IN ($placeholders)");
                } else {
                    $stmt = $pdo->prepare("UPDATE categories SET show_on_site = 0 WHERE id IN ($placeholders)");
                }
                $stmt->execute($categoryIds);
                break;
                
            case 'show_in_nav':
                if ($hasUpdatedAt) {
                    $stmt = $pdo->prepare("UPDATE categories SET show_in_nav = 1, updated_at = CURRENT_TIMESTAMP WHERE id IN ($placeholders)");
                } else {
                    $stmt = $pdo->prepare("UPDATE categories SET show_in_nav = 1 WHERE id IN ($placeholders)");
                }
                $stmt->execute($categoryIds);
                break;
                
            case 'hide_in_nav':
                if ($hasUpdatedAt) {
                    $stmt = $pdo->prepare("UPDATE categories SET show_in_nav = 0, updated_at = CURRENT_TIMESTAMP WHERE id IN ($placeholders)");
                } else {
                    $stmt = $pdo->prepare("UPDATE categories SET show_in_nav = 0 WHERE id IN ($placeholders)");
                }
                $stmt->execute($categoryIds);
                break;
                
            case 'delete':
                // Проверяем наличие товаров
                foreach ($categoryIds as $categoryId) {
                    $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM product_category WHERE category_id = ?");
                    $stmt->execute([$categoryId]);
                    $count = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
                    if ($count > 0) {
                        throw new Exception("Category $categoryId has products and cannot be deleted");
                    }
                }
                $stmt = $pdo->prepare("DELETE FROM categories WHERE id IN ($placeholders)");
                $stmt->execute($categoryIds);
                break;
                
            default:
                throw new Exception("Unknown action: $action");
        }
        
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => "Bulk action '$action' completed"]);
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Error in bulk operation: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Handle bulk category operations for products (POST /products/bulk/categories)
 */
function handleProductsBulkCategories($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        return;
    }
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['product_ids']) || !is_array($input['product_ids']) || 
            !isset($input['category_ids']) || !is_array($input['category_ids']) ||
            !isset($input['action'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'product_ids, category_ids, and action are required']);
            return;
        }
        
        $productIds = $input['product_ids'];
        $categoryIds = $input['category_ids'];
        $action = $input['action']; // 'replace', 'add', 'remove'
        
        $pdo->beginTransaction();
        
        foreach ($productIds as $productId) {
            if ($action === 'replace') {
                // Удаляем все старые привязки
                $stmt = $pdo->prepare("DELETE FROM product_category WHERE product_id = ?");
                $stmt->execute([$productId]);
                
                // Добавляем новые привязки
                $stmt = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
                foreach ($categoryIds as $categoryId) {
                    $stmt->execute([$productId, $categoryId]);
                }
            } elseif ($action === 'add') {
                // Добавляем категории, не удаляя существующие
                $stmt = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
                foreach ($categoryIds as $categoryId) {
                    $stmt->execute([$productId, $categoryId]);
                }
            } elseif ($action === 'remove') {
                // Удаляем только указанные категории
                $placeholders = implode(',', array_fill(0, count($categoryIds), '?'));
                $stmt = $pdo->prepare("DELETE FROM product_category WHERE product_id = ? AND category_id IN ($placeholders)");
                $stmt->execute(array_merge([$productId], $categoryIds));
            } else {
                throw new Exception("Unknown action: $action");
            }
        }
        
        $pdo->commit();
        echo json_encode([
            'success' => true, 
            'message' => "Bulk category operation '$action' completed for " . count($productIds) . " products"
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Error in bulk product categories operation: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Handle categories restore (POST /categories/restore) - восстановление базовых категорий
 */
function handleCategoriesRestore($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        return;
    }
    
    try {
        // Проверяем наличие таблицы
        $tableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'");
        if ($tableCheck->fetchColumn() === false) {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    parent_id INTEGER,
                    name TEXT NOT NULL,
                    slug TEXT UNIQUE,
                    description TEXT,
                    image_url TEXT,
                    seo_title TEXT,
                    seo_description TEXT,
                    seo_keywords TEXT,
                    position INTEGER DEFAULT 0,
                    show_on_site BOOLEAN DEFAULT 1,
                    show_in_nav BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
                )
            ");
            runMigrations($pdo);
        }
        
        // Проверяем наличие колонок
        $columnsCheck = $pdo->query("PRAGMA table_info(categories)");
        $columns = $columnsCheck->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_column($columns, 'name');
        
        $hasPosition = in_array('position', $columnNames);
        $hasShowOnSite = in_array('show_on_site', $columnNames);
        $hasShowInNav = in_array('show_in_nav', $columnNames);
        
        // Базовые категории для восстановления
        $categories = [
            ['name' => 'Пицца', 'slug' => 'pizza', 'position' => 1, 'show_on_site' => 1, 'show_in_nav' => 1],
            ['name' => 'Суши', 'slug' => 'sushi', 'position' => 2, 'show_on_site' => 1, 'show_in_nav' => 1],
            ['name' => 'Напитки', 'slug' => 'drinks', 'position' => 3, 'show_on_site' => 1, 'show_in_nav' => 1],
            ['name' => 'Десерты', 'slug' => 'desserts', 'position' => 4, 'show_on_site' => 1, 'show_in_nav' => 1]
        ];
        
        $created = 0;
        $skipped = 0;
        
        foreach ($categories as $cat) {
            // Проверяем, существует ли уже категория с таким slug
            $checkStmt = $pdo->prepare("SELECT id FROM categories WHERE slug = ?");
            $checkStmt->execute([$cat['slug']]);
            if ($checkStmt->fetch()) {
                $skipped++;
                continue;
            }
            
            try {
                if ($hasPosition && $hasShowOnSite && $hasShowInNav) {
                    $stmt = $pdo->prepare("INSERT INTO categories (name, slug, position, show_on_site, show_in_nav) VALUES (?, ?, ?, ?, ?)");
                    $stmt->execute([$cat['name'], $cat['slug'], $cat['position'], $cat['show_on_site'], $cat['show_in_nav']]);
                } elseif ($hasPosition) {
                    $stmt = $pdo->prepare("INSERT INTO categories (name, slug, position) VALUES (?, ?, ?)");
                    $stmt->execute([$cat['name'], $cat['slug'], $cat['position']]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO categories (name, slug) VALUES (?, ?)");
                    $stmt->execute([$cat['name'], $cat['slug']]);
                }
                $created++;
            } catch (Exception $e) {
                error_log("Error restoring category {$cat['name']}: " . $e->getMessage());
            }
        }
        
        echo json_encode([
            'success' => true,
            'message' => "Восстановлено категорий: $created, пропущено: $skipped",
            'created' => $created,
            'skipped' => $skipped
        ]);
    } catch (Exception $e) {
        error_log("Error restoring categories: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database error',
            'message' => $e->getMessage()
        ]);
    }
}

function handleOrders($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            // Добавляем сведения о документе списания (если таблицы уже созданы)
            $hasWriteoff = false;
            try {
                $check = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='writeoff_documents'");
                $hasWriteoff = ($check && $check->fetchColumn()) ? true : false;
            } catch (Exception $e) {
                $hasWriteoff = false;
            }

            if ($hasWriteoff) {
                $stmt = $pdo->query("
                    SELECT 
                        o.*,
                        wd.id AS writeoff_document_id,
                        wd.doc_number AS writeoff_doc_number,
                        wd.status AS writeoff_status,
                        wd.doc_date AS writeoff_doc_date
                    FROM orders o
                    LEFT JOIN writeoff_documents wd ON wd.order_id = o.id
                    ORDER BY o.created_at DESC
                ");
            } else {
            $stmt = $pdo->query("SELECT * FROM orders ORDER BY created_at DESC");
            }

            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            // Decode JSON items for each order
            foreach ($orders as &$order) {
                $order['items'] = json_decode($order['items'], true);
            }
            echo json_encode(['success' => true, 'data' => $orders]);
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!$input) {
                    throw new Exception('Invalid JSON input');
                }
                
                // Extract data from the input
                $customerName = $input['customerName'] ?? $input['customer_name'] ?? '';
                $phone = $input['phone'] ?? $input['customerPhone'] ?? '';
                $address = $input['address'] ?? $input['deliveryAddress'] ?? '';
                $total = $input['total'] ?? 0;
                $items = $input['items'] ?? [];
                $paymentMethod = $input['paymentMethod'] ?? $input['payment_method'] ?? null;
                $deliveryType = $input['deliveryType'] ?? $input['delivery_type'] ?? null;
                $source = $input['source'] ?? null;
                
                if (empty($customerName) || empty($phone)) {
                    throw new Exception('Missing required fields: customerName or phone');
                }

                // Ensure optional columns exist for reporting
                try {
                    $pdo->exec("ALTER TABLE orders ADD COLUMN payment_method TEXT");
                } catch (Exception $e) {
                    // ignore
                }
                try {
                    $pdo->exec("ALTER TABLE orders ADD COLUMN delivery_type TEXT");
                } catch (Exception $e) {
                    // ignore
                }
                try {
                    $pdo->exec("ALTER TABLE orders ADD COLUMN source TEXT");
                } catch (Exception $e) {
                    // ignore
                }

                // Detect existing columns (SQLite)
                $hasPayment = false;
                $hasDelivery = false;
                $hasSource = false;
                try {
                    $cols = $pdo->query("PRAGMA table_info(orders)")->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($cols as $col) {
                        $name = $col['name'] ?? '';
                        if ($name === 'payment_method') $hasPayment = true;
                        if ($name === 'delivery_type') $hasDelivery = true;
                        if ($name === 'source') $hasSource = true;
                    }
                } catch (Exception $e) {
                    // ignore
                }

                $fields = ['customer_name', 'phone', 'address', 'total', 'items', 'status'];
                $placeholders = ['?', '?', '?', '?', '?', '?'];
                $params = [
                    $customerName,
                    $phone,
                    $address,
                    $total,
                    json_encode($items),
                    'pending'
                ];
                if ($hasPayment) {
                    $fields[] = 'payment_method';
                    $placeholders[] = '?';
                    $params[] = $paymentMethod;
                }
                if ($hasDelivery) {
                    $fields[] = 'delivery_type';
                    $placeholders[] = '?';
                    $params[] = $deliveryType;
                }
                if ($hasSource) {
                    $fields[] = 'source';
                    $placeholders[] = '?';
                    $params[] = $source;
                }
                
                $stmt = $pdo->prepare("INSERT INTO orders (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $placeholders) . ")");
                $stmt->execute($params);
                
                $orderId = $pdo->lastInsertId();

                try {
                    appendInventoryEvent([
                        'type' => 'order_created',
                        'source' => 'storefront',
                        'order_id' => intval($orderId),
                        'payment_method' => $paymentMethod,
                        'delivery_type' => $deliveryType,
                        'order_total' => $total,
                        'items' => $items
                    ]);
                } catch (Exception $e) {
                    error_log("Failed to append order_created event: " . $e->getMessage());
                }
                
                // Списание ингредиентов из техкарт при продаже блюд
                try {
                    debitIngredientsFromOrder($pdo, $orderId, $items);
                } catch (Exception $e) {
                    error_log("Error debiting ingredients from order $orderId: " . $e->getMessage());
                    // Не прерываем создание заказа, только логируем ошибку
                }
                
                // Return format expected by checkout.html
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'id' => $orderId,
                        'customer_name' => $customerName,
                        'phone' => $phone,
                        'address' => $address,
                        'total' => $total,
                        'status' => 'pending',
                        'created_at' => date('Y-m-d H:i:s')
                    ]
                ]);
            } catch (Exception $e) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => $e->getMessage()
                ]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

/**
 * Списание ингредиентов из техкарт при продаже блюд
 * Реализует автоматическое списание по техкартам с поддержкой FIFO/FEFO
 */
function debitIngredientsFromOrder($pdo, $orderId, $items) {
    try {
        // Проверяем наличие таблиц и создаем при необходимости
        try {
            ensureInventoryBalancesTable($pdo);

            // Таблица документов списания
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS writeoff_documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER,
                    doc_number TEXT UNIQUE,
                    doc_date DATE DEFAULT CURRENT_DATE,
                    warehouse_id INTEGER DEFAULT 2,
                    reason TEXT DEFAULT 'sale',
                    status TEXT DEFAULT 'posted',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
                )
            ");

            // Таблица строк документов списания
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS writeoff_lines (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    document_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    quantity DECIMAL(10,3) NOT NULL,
                    unit TEXT DEFAULT 'шт',
                    batch_number TEXT,
                    balance_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (document_id) REFERENCES writeoff_documents(id) ON DELETE CASCADE,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                    FOREIGN KEY (balance_id) REFERENCES inventory_balances(id) ON DELETE SET NULL
                )
            ");

            // Таблица правил списания модификаторов (43_MOD): модификатор -> ингредиенты
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS modifier_ingredients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    modifier_id INTEGER NOT NULL,
                    ingredient_product_id INTEGER NOT NULL,
                    quantity DECIMAL(10,3) NOT NULL,
                    unit TEXT DEFAULT 'шт',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_modifier_ingredients_modifier ON modifier_ingredients(modifier_id)");
        } catch (Exception $e) {
            error_log("Error creating inventory tables: " . $e->getMessage());
        }
        
        $warehouseId = 2; // Кухня/Цех (WH-KITCHEN)
        $debitLog = [];
        $writeoffLines = [];

        $docNumber = 'WO-' . date('Ymd') . '-' . str_pad($orderId, 6, '0', STR_PAD_LEFT);
        $documentId = null;
        $ensureWriteoffDoc = function() use ($pdo, $orderId, $docNumber, $warehouseId, &$documentId) {
            if ($documentId !== null) return $documentId;
            $docStmt = $pdo->prepare("INSERT INTO writeoff_documents (order_id, doc_number, doc_date, warehouse_id, reason, status) VALUES (?, ?, CURRENT_DATE, ?, 'sale', 'posted')");
            $docStmt->execute([$orderId, $docNumber, $warehouseId]);
            $documentId = $pdo->lastInsertId();
            return $documentId;
        };
        
        foreach ($items as $item) {
            // ✅ КРИТИЧНО (по ТЗ): списание должно идти по варианту (дочернему товару), если он выбран
            $rawVariantId = $item['variantId'] ?? $item['variant_id'] ?? $item['variantID'] ?? null;
            $variantId = null;
            if ($rawVariantId !== null && $rawVariantId !== '') {
                $variantIdNum = intval($rawVariantId);
                if ($variantIdNum > 0) {
                    $variantId = $variantIdNum;
                }
            }

            $productId = $item['id'] ?? $item['productId'] ?? null;
            $quantity = floatval($item['quantity'] ?? $item['qty'] ?? 1);

            $effectiveProductId = $variantId ?: $productId;
            if (!$effectiveProductId) continue;

            // Коэффициент рецепта (для размеров/вариантов)
            $recipeCoefficient = 1.0;
            try {
                $coefStmt = $pdo->prepare("SELECT recipe_coefficient FROM products WHERE id = ? LIMIT 1");
                $coefStmt->execute([intval($effectiveProductId)]);
                $coefRow = $coefStmt->fetch(PDO::FETCH_ASSOC);
                if ($coefRow && isset($coefRow['recipe_coefficient'])) {
                    $rc = floatval($coefRow['recipe_coefficient']);
                    if ($rc > 0) {
                        $recipeCoefficient = $rc;
                    }
                }
            } catch (Exception $e) {
                $recipeCoefficient = 1.0;
            }
            
            // Проверяем, является ли товар блюдом (type='dish')
            // ✅ skip_inventory: витринные карточки не участвуют в списании
            $productStmt = $pdo->prepare("SELECT id, type, name, skip_inventory FROM products WHERE id = ?");
            $productStmt->execute([$effectiveProductId]);
            $product = $productStmt->fetch(PDO::FETCH_ASSOC);

            if ($product && isset($product['skip_inventory']) && intval($product['skip_inventory']) === 1) {
                // Витринная карточка / display_only=true — не списываем
                continue;
            }
            
            if (!$product || ($product['type'] ?? 'product') !== 'dish') {
                continue; // Пропускаем не-блюда
            }
            
            // Находим техкарту по product_id
            $recipeStmt = $pdo->prepare("SELECT id, name, ingredients FROM recipes WHERE product_id = ? AND is_active = 1 LIMIT 1");
            $recipeStmt->execute([$effectiveProductId]);
            $recipe = $recipeStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$recipe) {
                error_log("Recipe not found for dish product_id=$effectiveProductId");
                continue;
            }
            
            // Декодируем ингредиенты
            $ingredients = json_decode($recipe['ingredients'], true);
            if (!is_array($ingredients) || empty($ingredients)) {
                continue;
            }
            
            // Для каждого ингредиента списываем количество
            foreach ($ingredients as $ingredient) {
                $ingredientId = $ingredient['product_id'] ?? $ingredient['id'] ?? null;
                $ingredientQty = floatval($ingredient['quantity'] ?? $ingredient['qty'] ?? 0);
                $ingredientUnit = $ingredient['unit'] ?? 'шт';
                
                if (!$ingredientId || $ingredientQty <= 0) continue;
                
                // Рассчитываем количество для списания (с учетом количества блюд и коэффициента варианта)
                $debitQuantity = $ingredientQty * $quantity * $recipeCoefficient;
                
                // Списываем по FIFO (первый пришёл - первый ушёл) или FEFO (первый истекает - первый ушёл)
                $docId = $ensureWriteoffDoc();
                $debitResult = debitIngredientFIFO($pdo, $ingredientId, $warehouseId, $debitQuantity, $ingredientUnit, $docId);
                
                if ($debitResult) {
                    $debitLog[] = $debitResult;
                    $writeoffLines = array_merge($writeoffLines, $debitResult['lines'] ?? []);
                }
            }

            // Дополнительные списания по модификаторам (43_MOD)
            $modSelections = extractOrderItemModifierSelections($item);
            if (!empty($modSelections)) {
                $rulesStmt = $pdo->prepare("SELECT ingredient_product_id, quantity, unit FROM modifier_ingredients WHERE modifier_id = ?");
                foreach ($modSelections as $sel) {
                    $modifierId = resolveModifierIdForSelection($pdo, $sel);
                    $modifierQty = floatval($sel['qty'] ?? 1);
                    if ($modifierId <= 0 || $modifierQty <= 0) continue;

                    $rulesStmt->execute([$modifierId]);
                    $rules = $rulesStmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($rules as $rule) {
                        $ingredientId = intval($rule['ingredient_product_id'] ?? 0);
                        $ingredientQty = floatval($rule['quantity'] ?? 0);
                        $ingredientUnit = $rule['unit'] ?? 'шт';
                        if ($ingredientId <= 0 || $ingredientQty <= 0) continue;

                        // учитываем количество блюд и количество модификаторов
                        $debitQuantity = $ingredientQty * $quantity * $modifierQty * $recipeCoefficient;
                        $docId = $ensureWriteoffDoc();
                        $debitResult = debitIngredientFIFO($pdo, $ingredientId, $warehouseId, $debitQuantity, $ingredientUnit, $docId);
                        if ($debitResult) {
                            $debitLog[] = $debitResult;
                            $writeoffLines = array_merge($writeoffLines, $debitResult['lines'] ?? []);
                        }
                    }
                }
            }
        }
        
        // Проверяем остатки ингредиентов и автоматически снимаем блюда с продажи при дефиците
        checkAndHideDishesWithLowStock($pdo);
        
        // Логируем списание
        if (!empty($debitLog)) {
            error_log("Order $orderId: Debited ingredients via document $docNumber: " . json_encode($debitLog, JSON_UNESCAPED_UNICODE));
        }
        
        return [
            'document_id' => $documentId,
            'document_number' => $docNumber,
            'debit_log' => $debitLog
        ];
    } catch (Exception $e) {
        error_log("Error in debitIngredientsFromOrder: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Списание ингредиента по методу FIFO/FEFO
 */
function debitIngredientFIFO($pdo, $ingredientId, $warehouseId, $debitQuantity, $unit, $documentId) {
    // Получаем все партии ингредиента на складе, отсортированные по дате поступления (FIFO)
    // Если есть expiry_date, сортируем по ней (FEFO)
    $balanceStmt = $pdo->prepare("
        SELECT id, quantity, batch_number, expiry_date, purchase_price 
        FROM inventory_balances 
        WHERE product_id = ? AND warehouse_id = ? AND quantity > 0
        ORDER BY 
            CASE WHEN expiry_date IS NOT NULL THEN expiry_date ELSE '9999-12-31' END ASC,
            created_at ASC
    ");
    $balanceStmt->execute([$ingredientId, $warehouseId]);
    $batches = $balanceStmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($batches)) {
        error_log("Warning: No batches found for ingredient product_id=$ingredientId, warehouse_id=$warehouseId");
        // Создаем запись с нулевым остатком
        $insertStmt = $pdo->prepare("INSERT INTO inventory_balances (product_id, warehouse_id, quantity, unit) VALUES (?, ?, 0, ?)");
        $insertStmt->execute([$ingredientId, $warehouseId, $unit]);
        return [
            'ingredient_id' => $ingredientId,
            'quantity' => $debitQuantity,
            'new_balance' => 0,
            'warning' => 'No initial balance',
            'lines' => []
        ];
    }
    
    $remainingToDebit = $debitQuantity;
    $debitLines = [];
    $totalDebited = 0;
    
    foreach ($batches as $batch) {
        if ($remainingToDebit <= 0) break;
        
        $batchQuantity = floatval($batch['quantity']);
        $debitFromBatch = min($remainingToDebit, $batchQuantity);
        $newBatchQuantity = $batchQuantity - $debitFromBatch;
        
        // Обновляем остаток партии
        $updateStmt = $pdo->prepare("UPDATE inventory_balances SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $updateStmt->execute([$newBatchQuantity, $batch['id']]);
        
        // Создаем строку документа списания
        $lineStmt = $pdo->prepare("INSERT INTO writeoff_lines (document_id, product_id, quantity, unit, batch_number, balance_id) VALUES (?, ?, ?, ?, ?, ?)");
        $lineStmt->execute([
            $documentId,
            $ingredientId,
            $debitFromBatch,
            $unit,
            $batch['batch_number'] ?? null,
            $batch['id']
        ]);
        
        $debitLines[] = [
            'balance_id' => $batch['id'],
            'batch_number' => $batch['batch_number'],
            'quantity' => $debitFromBatch,
            'remaining_in_batch' => $newBatchQuantity
        ];
        
        $totalDebited += $debitFromBatch;
        $remainingToDebit -= $debitFromBatch;
    }
    
    // Если не хватило остатков, логируем предупреждение
    if ($remainingToDebit > 0) {
        error_log("Warning: Insufficient balance for ingredient product_id=$ingredientId. Requested: $debitQuantity, Debited: $totalDebited, Shortage: $remainingToDebit");
    }
    
    // Вычисляем итоговый остаток
    $totalBalanceStmt = $pdo->prepare("SELECT SUM(quantity) as total FROM inventory_balances WHERE product_id = ? AND warehouse_id = ?");
    $totalBalanceStmt->execute([$ingredientId, $warehouseId]);
    $totalBalance = $totalBalanceStmt->fetch(PDO::FETCH_ASSOC);
    $newBalance = floatval($totalBalance['total'] ?? 0);
    
    return [
        'ingredient_id' => $ingredientId,
        'quantity' => $totalDebited,
        'requested' => $debitQuantity,
        'shortage' => max(0, $remainingToDebit),
        'new_balance' => $newBalance,
        'lines' => $debitLines
    ];
}

/**
 * Проверяет остатки ингредиентов и автоматически снимает блюда с продажи при дефиците
 */
function checkAndHideDishesWithLowStock($pdo) {
    try {
        // Получаем все активные техкарты (блюда)
        $recipesStmt = $pdo->query("
            SELECT r.id, r.product_id, r.name, r.ingredients, p.name as product_name, p.visible_on_site
            FROM recipes r
            INNER JOIN products p ON r.product_id = p.id
            WHERE r.is_active = 1 AND (p.visible_on_site = 1 OR p.visible_on_site IS NULL)
        ");
        $recipes = $recipesStmt->fetchAll(PDO::FETCH_ASSOC);
        
        $warehouseId = 2;
        $hiddenDishes = [];
        
        foreach ($recipes as $recipe) {
            $ingredients = json_decode($recipe['ingredients'], true);
            if (!is_array($ingredients) || empty($ingredients)) {
                continue;
            }
            
            $hasDeficit = false;
            $deficitDetails = [];
            
            // Проверяем остатки каждого ингредиента
            foreach ($ingredients as $ingredient) {
                $ingredientId = $ingredient['product_id'] ?? $ingredient['id'] ?? null;
                $requiredQty = floatval($ingredient['quantity'] ?? $ingredient['qty'] ?? 0);
                $requiredUnit = $ingredient['unit'] ?? 'шт';
                
                if (!$ingredientId || $requiredQty <= 0) continue;

                $targetType = inferQuantityTypeFromUnit($requiredUnit);
                $requiredBase = convertToTypeQuantity($requiredQty, $requiredUnit, $targetType);
                if ($requiredBase === null || $requiredBase <= 0) {
                    continue;
                }
                $currentBase = getProductAvailableBaseQty($pdo, $ingredientId, $warehouseId, $targetType, $requiredUnit);

                if ($currentBase < $requiredBase) {
                    $hasDeficit = true;
                    $ingredientName = $ingredient['name'] ?? "ID: $ingredientId";
                    $deficitDetails[] = "$ingredientName: требуется $requiredQty $requiredUnit, в наличии " . round($currentBase, 3) . " base";
                }
            }
            
            // Если есть дефицит, снимаем блюдо с продажи
            if ($hasDeficit && $recipe['product_id']) {
                $updateStmt = $pdo->prepare("UPDATE products SET visible_on_site = 0 WHERE id = ?");
                $updateStmt->execute([$recipe['product_id']]);
                
                $hiddenDishes[] = [
                    'product_id' => $recipe['product_id'],
                    'name' => $recipe['product_name'] ?? $recipe['name'],
                    'deficit' => $deficitDetails
                ];
                
                error_log("Auto-hidden dish product_id={$recipe['product_id']} ({$recipe['product_name']}) due to ingredient deficit: " . implode(', ', $deficitDetails));
            }
        }
        
        // Если были скрыты блюда, возвращаем информацию
        if (!empty($hiddenDishes)) {
            return [
                'hidden_count' => count($hiddenDishes),
                'hidden_dishes' => $hiddenDishes
            ];
        }
        
        return ['hidden_count' => 0, 'hidden_dishes' => []];
    } catch (Exception $e) {
        error_log("Error in checkAndHideDishesWithLowStock: " . $e->getMessage());
        return ['hidden_count' => 0, 'hidden_dishes' => [], 'error' => $e->getMessage()];
    }
}

/**
 * Валидация и парсинг ставки НДС
 * Принимает: "10%", "20%", "10", "20", "Без НДС", "без ндс", "0%", "0"
 * Возвращает: "10%", "20%", "Без НДС" или null при ошибке
 */
function parseVATRate($vatInput) {
    if (empty($vatInput)) {
        return null;
    }
    
    $vat = trim($vatInput);
    
    // Нормализуем: убираем пробелы, приводим к нижнему регистру для сравнения
    $vatLower = mb_strtolower($vat);
    
    // Проверяем варианты "Без НДС"
    if (in_array($vatLower, ['без ндс', 'безндс', '0%', '0', 'none', 'n/a', 'н/д'])) {
        return 'Без НДС';
    }
    
    // Извлекаем число из строки
    $vatNumber = preg_replace('/[^0-9.]/', '', $vat);
    $vatValue = floatval($vatNumber);
    
    // Проверяем допустимые значения (строгая валидация)
    if ($vatValue == 10) {
        return '10%';
    } elseif ($vatValue == 20) {
        return '20%';
    } elseif ($vatValue == 0) {
        return 'Без НДС';
    }
    
    // Если значение не распознано, возвращаем null
    error_log("Warning: Invalid VAT rate value: '$vatInput' (parsed as $vatValue). Allowed values: 10%, 20%, Без НДС");
    return null;
}

function handleSingleOrder($pdo, $orderId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            // Подмешиваем данные документа списания (если есть)
            $hasWriteoff = false;
            try {
                $check = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='writeoff_documents'");
                $hasWriteoff = ($check && $check->fetchColumn()) ? true : false;
            } catch (Exception $e) {
                $hasWriteoff = false;
            }

            if ($hasWriteoff) {
                $stmt = $pdo->prepare("
                    SELECT 
                        o.*,
                        wd.id AS writeoff_document_id,
                        wd.doc_number AS writeoff_doc_number,
                        wd.status AS writeoff_status,
                        wd.doc_date AS writeoff_doc_date
                    FROM orders o
                    LEFT JOIN writeoff_documents wd ON wd.order_id = o.id
                    WHERE o.id = ?
                    LIMIT 1
                ");
                $stmt->execute([$orderId]);
                $order = $stmt->fetch(PDO::FETCH_ASSOC);
            } else {
            $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
            $stmt->execute([$orderId]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            }
            
            if ($order) {
                $order['items'] = json_decode($order['items'], true);
                echo json_encode(['success' => true, 'data' => $order]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Order not found']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleOrderWriteoff($pdo, $orderId) {
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        return;
    }

    try {
        // Проверяем наличие таблиц
        $check = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='writeoff_documents'");
        $hasWriteoffDocs = ($check && $check->fetchColumn()) ? true : false;
        if (!$hasWriteoffDocs) {
            echo json_encode(['success' => true, 'data' => null]);
            return;
        }

        $docStmt = $pdo->prepare("
            SELECT id, order_id, doc_number, doc_date, warehouse_id, reason, status, created_at
            FROM writeoff_documents
            WHERE order_id = ?
            ORDER BY id DESC
            LIMIT 1
        ");
        $docStmt->execute([$orderId]);
        $doc = $docStmt->fetch(PDO::FETCH_ASSOC);

        if (!$doc) {
            echo json_encode(['success' => true, 'data' => null]);
            return;
        }

        $checkLines = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='writeoff_lines'");
        $hasLines = ($checkLines && $checkLines->fetchColumn()) ? true : false;

        $lines = [];
        if ($hasLines) {
            $linesStmt = $pdo->prepare("
                SELECT 
                    wl.id,
                    wl.product_id,
                    p.name AS product_name,
                    wl.quantity,
                    wl.unit,
                    wl.batch_number,
                    wl.balance_id,
                    wl.created_at
                FROM writeoff_lines wl
                LEFT JOIN products p ON p.id = wl.product_id
                WHERE wl.document_id = ?
                ORDER BY wl.id ASC
            ");
            $linesStmt->execute([$doc['id']]);
            $lines = $linesStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'document' => $doc,
                'lines' => $lines
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database error',
            'message' => $e->getMessage()
        ]);
    }
}

function handleOrderStatus($pdo, $orderId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            $newStatus = $input['status'] ?? null;
            
            if (!$newStatus) {
                http_response_code(400);
                echo json_encode(['error' => 'Status is required']);
                return;
            }
            
            $stmt = $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?");
            $result = $stmt->execute([$newStatus, $orderId]);
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'Status updated']);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Order not found']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleOrderAddress($pdo, $orderId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            $newAddress = $input['address'] ?? null;
            
            if (!$newAddress) {
                http_response_code(400);
                echo json_encode(['error' => 'Address is required']);
                return;
            }
            
            $stmt = $pdo->prepare("UPDATE orders SET address = ? WHERE id = ?");
            $result = $stmt->execute([$newAddress, $orderId]);
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'Address updated']);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Order not found']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleProjects($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $stmt = $pdo->query("SELECT * FROM projects ORDER BY created_at DESC");
            $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $projects]);
            break;
            
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            $name = $input['name'] ?? '';
            $description = $input['description'] ?? '';
            $domain = $input['domain'] ?? '';
            $status = $input['status'] ?? 'active';
            
            if (!$name) {
                http_response_code(400);
                echo json_encode(['error' => 'Project name is required']);
                return;
            }
            
            $stmt = $pdo->prepare("
                INSERT INTO projects (name, description, domain, status, created_at, updated_at) 
                VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            ");
            
            $result = $stmt->execute([$name, $description, $domain, $status]);
            
            if ($result) {
                $projectId = $pdo->lastInsertId();
                $stmt = $pdo->prepare("SELECT * FROM projects WHERE id = ?");
                $stmt->execute([$projectId]);
                $project = $stmt->fetch(PDO::FETCH_ASSOC);
                
                echo json_encode(['success' => true, 'data' => $project]);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Failed to create project']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleSingleProject($pdo, $projectId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $stmt = $pdo->prepare("SELECT * FROM projects WHERE id = ?");
            $stmt->execute([$projectId]);
            $project = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($project) {
                echo json_encode(['success' => true, 'data' => $project]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Project not found']);
            }
            break;
            
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            $name = $input['name'] ?? '';
            $description = $input['description'] ?? '';
            $domain = $input['domain'] ?? '';
            $status = $input['status'] ?? '';
            
            $updateFields = [];
            $params = [];
            
            if ($name) {
                $updateFields[] = "name = ?";
                $params[] = $name;
            }
            if ($description !== '') {
                $updateFields[] = "description = ?";
                $params[] = $description;
            }
            if ($domain) {
                $updateFields[] = "domain = ?";
                $params[] = $domain;
            }
            if ($status) {
                $updateFields[] = "status = ?";
                $params[] = $status;
            }
            
            if (empty($updateFields)) {
                http_response_code(400);
                echo json_encode(['error' => 'No fields to update']);
                return;
            }
            
            $updateFields[] = "updated_at = datetime('now')";
            $params[] = $projectId;
            
            $sql = "UPDATE projects SET " . implode(', ', $updateFields) . " WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $result = $stmt->execute($params);
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'Project updated']);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Project not found']);
            }
            break;
            
        case 'DELETE':
            $stmt = $pdo->prepare("DELETE FROM projects WHERE id = ?");
            $result = $stmt->execute([$projectId]);
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'Project deleted']);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Project not found']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Recipes handler
function handleRecipes($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $stmt = $pdo->query("SELECT * FROM recipes ORDER BY created_at DESC");
            $recipes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Декодируем JSON поля
            foreach ($recipes as &$recipe) {
                if (isset($recipe['ingredients']) && is_string($recipe['ingredients'])) {
                    $recipe['ingredients'] = json_decode($recipe['ingredients'], true) ?: [];
                }
            }
            
            echo json_encode(['ok' => true, 'success' => true, 'data' => $recipes]);
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                // Рассчитываем себестоимость
                $cost = calculateRecipeCostFromIngredients($pdo, $input['ingredients'] ?? [], $input['loss_percentage'] ?? 0, $input['markup'] ?? 0);
                
                // Сохраняем техкарту
                $stmt = $pdo->prepare("INSERT INTO recipes (name, description, category_id, output_quantity, output_unit, cooking_time, loss_percentage, cooking_instructions, ingredients, cost, is_active, markup) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $input['name'],
                    $input['description'] ?? null,
                    $input['category_id'] ?? null,
                    $input['output_quantity'],
                    $input['output_unit'],
                    $input['cooking_time'] ?? null,
                    $input['loss_percentage'] ?? 0,
                    $input['cooking_instructions'] ?? null,
                    json_encode($input['ingredients'] ?? []),
                    $cost,
                    $input['is_active'] !== false ? 1 : 0,
                    $input['markup'] ?? 0
                ]);
                
                $recipeId = $pdo->lastInsertId();
                
                // Создаем или обновляем товар типа "dish" с автоматической себестоимостью
                $productId = createOrUpdateDishFromRecipe($pdo, $recipeId, $input, $cost);
                
                // Обновляем техкарту с product_id
                if ($productId) {
                    try {
                        $pdo->exec("ALTER TABLE recipes ADD COLUMN product_id INTEGER");
                    } catch (Exception $e) {
                        // Колонка уже существует
                    }
                $updateStmt = $pdo->prepare("UPDATE recipes SET product_id = ? WHERE id = ?");
                $updateStmt->execute([$productId, $recipeId]);
                }
                
                // Получаем созданную техкарту
                $stmt = $pdo->prepare("SELECT * FROM recipes WHERE id = ?");
                $stmt->execute([$recipeId]);
                $recipe = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($recipe && isset($recipe['ingredients']) && is_string($recipe['ingredients'])) {
                    $recipe['ingredients'] = json_decode($recipe['ingredients'], true) ?: [];
                }
                
                echo json_encode(['ok' => true, 'success' => true, 'data' => $recipe, 'id' => $recipeId, 'product_id' => $productId, 'cost' => $cost]);
            } catch (Exception $e) {
                error_log("Error creating recipe: " . $e->getMessage());
                error_log("Stack trace: " . $e->getTraceAsString());
                http_response_code(500);
                echo json_encode(['ok' => false, 'success' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    }
}

/**
 * Рассчитать себестоимость техкарты из ингредиентов
 */
function calculateRecipeCostFromIngredients($pdo, $ingredients, $lossPercentage = 0, $markup = 0) {
    if (empty($ingredients) || !is_array($ingredients)) {
        return 0;
    }
    
    $totalCost = 0;
    
    foreach ($ingredients as $ing) {
        $productId = $ing['product_id'] ?? $ing['id'] ?? null;
        if (!$productId) continue;
        
        $stmt = $pdo->prepare("SELECT cost, price FROM products WHERE id = ?");
        $stmt->execute([$productId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($product) {
            $quantity = floatval($ing['quantity'] ?? $ing['qty'] ?? 0);
            $price = floatval($product['cost'] ?? $product['price'] ?? 0);
            
            // Учитываем потери
            $actualQuantity = $quantity * (1 + $lossPercentage / 100);
            $totalCost += $actualQuantity * $price;
        }
    }
    
    // Применяем наценку
    if ($markup > 0) {
        $totalCost = $totalCost * (1 + $markup / 100);
    }
    
    return round($totalCost, 2);
}

function ensureRecipesProductIdColumn($pdo) {
    try {
        $pdo->exec("ALTER TABLE recipes ADD COLUMN product_id INTEGER");
    } catch (Exception $e) {
        // ignore
    }
    try {
        $pdo->exec("ALTER TABLE recipes ADD COLUMN markup DECIMAL(10,2) DEFAULT 0");
    } catch (Exception $e) {
        // ignore
    }
}

function upsertRecipeFromImportedIngredients($pdo, $dishProductId, $dishName, $ingredientsValue, $outputQty = 1, $outputUnit = 'порция', $logPath = null) {
    $pid = intval($dishProductId);
    if ($pid <= 0) return null;

    ensureRecipesProductIdColumn($pdo);

    $items = null;
    if (is_string($ingredientsValue) && trim($ingredientsValue) !== '') {
        $items = json_decode($ingredientsValue, true);
    } elseif (is_array($ingredientsValue)) {
        $items = $ingredientsValue;
    }
    if (!is_array($items) || empty($items)) return null;

    // Map {sku, qty, unit} -> {product_id, quantity, unit}
    $mapped = [];
    $findIng = $pdo->prepare("SELECT id, type FROM products WHERE sku = ? AND sku != '' LIMIT 1");
    foreach ($items as $it) {
        $sku = trim((string)($it['sku'] ?? $it['SKU'] ?? ''));
        $qty = floatval($it['qty'] ?? $it['quantity'] ?? 0);
        $unit = $it['unit'] ?? 'шт';
        if ($sku === '' || $qty <= 0) continue;
        try {
            $findIng->execute([$sku]);
            $row = $findIng->fetch(PDO::FETCH_ASSOC);
            if (!$row) continue;
            $ingId = intval($row['id'] ?? 0);
            if ($ingId <= 0) continue;
            $mapped[] = [
                'product_id' => $ingId,
                'quantity' => $qty,
                'unit' => $unit
            ];
        } catch (Exception $e) {
            continue;
        }
    }
    if (empty($mapped)) return null;

    $cost = calculateRecipeCostFromIngredients($pdo, $mapped, 0, 0);

    $check = $pdo->prepare("SELECT id FROM recipes WHERE product_id = ? LIMIT 1");
    $check->execute([$pid]);
    $existing = $check->fetch(PDO::FETCH_ASSOC);

    if ($existing && isset($existing['id'])) {
        $rid = intval($existing['id']);
        $upd = $pdo->prepare("UPDATE recipes SET name = ?, ingredients = ?, cost = ?, output_quantity = ?, output_unit = ?, is_active = 1 WHERE id = ?");
        $upd->execute([
            $dishName,
            json_encode($mapped, JSON_UNESCAPED_UNICODE),
            $cost,
            floatval($outputQty),
            (string)$outputUnit,
            $rid
        ]);
        return $rid;
    }

    $ins = $pdo->prepare("INSERT INTO recipes (name, description, category_id, output_quantity, output_unit, cooking_time, loss_percentage, cooking_instructions, ingredients, cost, is_active, created_at, product_id)
        VALUES (?, NULL, NULL, ?, ?, NULL, 0, NULL, ?, ?, 1, datetime('now'), ?)");
    $ins->execute([
        $dishName,
        floatval($outputQty),
        (string)$outputUnit,
        json_encode($mapped, JSON_UNESCAPED_UNICODE),
        $cost,
        $pid
    ]);
    return intval($pdo->lastInsertId());
}

/**
 * Создать или обновить товар типа "dish" из техкарты
 */
function createOrUpdateDishFromRecipe($pdo, $recipeId, $recipeData, $cost) {
    try {
        // Проверяем, есть ли уже товар для этой техкарты
        try {
            $pdo->exec("ALTER TABLE recipes ADD COLUMN product_id INTEGER");
        } catch (Exception $e) {
            // Колонка уже существует
        }
        
        $checkStmt = $pdo->prepare("SELECT product_id FROM recipes WHERE id = ?");
        $checkStmt->execute([$recipeId]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        $productId = $existing['product_id'] ?? null;
        
        // Проверяем существование колонки type в products
        try {
            $pdo->exec("ALTER TABLE products ADD COLUMN type TEXT DEFAULT 'product'");
        } catch (Exception $e) {
            // Колонка уже существует
        }
        
        if ($productId) {
            // Обновляем существующий товар
            $updateStmt = $pdo->prepare("UPDATE products SET name = ?, cost = ?, type = 'dish', description = ? WHERE id = ?");
            $updateStmt->execute([
                $recipeData['name'],
                $cost,
                $recipeData['description'] ?? null,
                $productId
            ]);
            return $productId;
        } else {
            // Создаем новый товар типа "dish"
            $insertStmt = $pdo->prepare("
                INSERT INTO products (name, type, cost, price, description, visible_on_site, available, category_id)
                VALUES (?, 'dish', ?, ?, ?, 1, 1, ?)
            ");
            $insertStmt->execute([
                $recipeData['name'],
                $cost,
                $cost * 1.5, // Цена продажи = себестоимость * 1.5 (можно настроить)
                $recipeData['description'] ?? null,
                $recipeData['category_id'] ?? null
            ]);
            return $pdo->lastInsertId();
        }
    } catch (Exception $e) {
        error_log("Error creating/updating dish from recipe: " . $e->getMessage());
        return null;
    }
}

// Promotions handler
function handlePromotions($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            try {
                // Проверяем существование таблицы
                $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='promotions'");
                if (!$stmt->fetch()) {
                    // Таблица не существует, создаем её
                    $pdo->exec("
                        CREATE TABLE IF NOT EXISTS promotions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            name TEXT NOT NULL,
                            description TEXT,
                            type TEXT NOT NULL,
                            discount_type TEXT,
                            discount_value DECIMAL(10,2),
                            start_date DATETIME,
                            end_date DATETIME,
                            min_order_amount DECIMAL(10,2),
                            max_uses INTEGER,
                            promo_code TEXT,
                            status TEXT DEFAULT 'active',
                            current_uses INTEGER DEFAULT 0,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    ");
                    
                    // Добавляем тестовые данные
                    $pdo->exec("
                        INSERT INTO promotions (name, description, type, discount_type, discount_value, start_date, end_date, status) VALUES 
                        ('Скидка 20% на пиццу', 'Скидка на все виды пиццы', 'discount', 'percentage', 20, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active'),
                        ('2 по цене 1', 'При покупке двух пицц - вторая бесплатно', 'bogo', 'none', 0, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active')
                    ");
                }
                
                $stmt = $pdo->query("SELECT * FROM promotions ORDER BY created_at DESC");
                $promotions = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'data' => $promotions]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
            }
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                $stmt = $pdo->prepare("INSERT INTO promotions (name, description, type, discount_type, discount_value, start_date, end_date, min_order_amount, max_uses, promo_code, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $input['name'],
                    $input['description'],
                    $input['type'],
                    $input['discount_type'],
                    $input['discount_value'],
                    $input['start_date'],
                    $input['end_date'],
                    $input['min_order_amount'],
                    $input['max_uses'],
                    $input['promo_code'],
                    $input['status']
                ]);
                echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
            }
            break;
            
        default:
            // Старый API не поддерживает DELETE напрямую - нужно использовать /api/admin-state/keys/promotions
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed', 'note' => 'Please use /api/admin-state/keys/promotions for DELETE operations']);
    }
}

// Handle single promotion by ID (for DELETE requests)
function handlePromotionById($pdo, $promotionId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'DELETE') {
        // Старый API не поддерживает удаление через DELETE /promotions/{id}
        // Акции теперь хранятся в /api/admin-state/keys/promotions
        // Возвращаем ошибку с информацией о правильном API
        http_response_code(405);
        echo json_encode([
            'error' => 'Method not allowed',
            'message' => 'DELETE operations for promotions should use /api/admin-state/keys/promotions',
            'note' => 'The promotions module now uses admin-state API. Delete operations should be done through the promotions management module.'
        ]);
        return;
    }
    
    // Для других методов - 405
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

// Loyalty config handler
function handleLoyaltyConfig($pdo) {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        return;
    }

    if ($method === 'GET') {
        try {
            $stmt = $pdo->prepare("SELECT value, updated_at FROM settings WHERE key = 'loyalty_config'");
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $config = $row ? json_decode($row['value'], true) : [];
            $pointsPerRub = isset($config['pointsPercent']) ? (float)$config['pointsPercent'] :
                (isset($config['pointsPerRub']) ? (float)$config['pointsPerRub'] : 1);
            $rubPerPoint = isset($config['pointValue']) ? (float)$config['pointValue'] :
                (isset($config['rubPerPoint']) ? (float)$config['rubPerPoint'] : 100);
            echo json_encode([
                'ok' => true,
                'enabled' => isset($config['enabled']) ? (bool)$config['enabled'] : true,
                'pointsPercent' => $pointsPerRub,
                'pointValue' => $rubPerPoint,
                'pointsPerRub' => $pointsPerRub,
                'rubPerPoint' => $rubPerPoint,
                'minOrderAmount' => $config['minOrderAmount'] ?? 0,
                'welcomeBonus' => $config['welcomeBonus'] ?? 0,
                'birthdayBonus' => $config['birthdayBonus'] ?? 0,
                'updatedAt' => $config['updatedAt'] ?? ($row['updated_at'] ?? null)
            ]);
        } catch (Exception $e) {
            echo json_encode([
                'ok' => true,
                'enabled' => true,
                'pointsPercent' => 1,
                'pointValue' => 100,
                'pointsPerRub' => 1,
                'rubPerPoint' => 100,
                'minOrderAmount' => 0,
                'welcomeBonus' => 0,
                'birthdayBonus' => 0
            ]);
        }
        return;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) {
            $input = $_POST;
        }
        $pointsPerRub = isset($input['pointsPercent']) ? (float)$input['pointsPercent'] :
            (isset($input['pointsPerRub']) ? (float)$input['pointsPerRub'] : 1);
        $rubPerPoint = isset($input['pointValue']) ? (float)$input['pointValue'] :
            (isset($input['rubPerPoint']) ? (float)$input['rubPerPoint'] : 100);
        $config = [
            'enabled' => isset($input['enabled']) ? (bool)$input['enabled'] : true,
            'pointsPercent' => $pointsPerRub,
            'pointValue' => $rubPerPoint,
            'pointsPerRub' => $pointsPerRub,
            'rubPerPoint' => $rubPerPoint,
            'minOrderAmount' => isset($input['minOrderAmount']) ? (float)$input['minOrderAmount'] : 0,
            'welcomeBonus' => isset($input['welcomeBonus']) ? (float)$input['welcomeBonus'] : 0,
            'birthdayBonus' => isset($input['birthdayBonus']) ? (float)$input['birthdayBonus'] : 0,
            'updatedAt' => new DateTimeImmutable('now', new DateTimeZone('UTC'))
        ];
        $config['updatedAt'] = $config['updatedAt']->format(DateTime::ATOM);
        try {
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('loyalty_config', ?, datetime('now'))");
            $stmt->execute([json_encode($config, JSON_UNESCAPED_UNICODE)]);
            echo json_encode(['ok' => true, 'config' => $config]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Failed to save config: ' . $e->getMessage()]);
        }
        return;
    }

    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
}

function handleLoyaltyStats($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $stats = [
                'total_earned' => 15000,
                'total_redeemed' => 8500,
                'customers_by_tier' => [
                    ['tier' => 'bronze', 'count' => 120],
                    ['tier' => 'silver', 'count' => 45],
                    ['tier' => 'gold', 'count' => 12],
                    ['tier' => 'platinum', 'count' => 3]
                ]
            ];
            echo json_encode(['success' => true, 'data' => $stats]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Warehouses handler
function handleWarehouses($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $warehouses = [
                ['id' => 1, 'name' => 'Основной склад', 'address' => 'ул. Примерная, 1'],
                ['id' => 2, 'name' => 'Холодильник', 'address' => 'ул. Примерная, 1']
            ];
            echo json_encode(['success' => true, 'data' => $warehouses]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Inventory items handler
function handleInventoryItems($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $items = [
                ['id' => 1, 'name' => 'Моцарелла', 'quantity' => 5.2, 'unit' => 'kg', 'expiry_date' => '2024-02-15'],
                ['id' => 2, 'name' => 'Лосось', 'quantity' => 2.1, 'unit' => 'kg', 'expiry_date' => '2024-02-10'],
                ['id' => 3, 'name' => 'Рис', 'quantity' => 25.0, 'unit' => 'kg', 'expiry_date' => '2024-12-31']
            ];
            echo json_encode(['success' => true, 'data' => $items]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Expiring items handler
function handleExpiringItems($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $days = $_GET['days'] ?? 7;
            $items = [
                ['id' => 1, 'name' => 'Моцарелла', 'quantity' => 0.8, 'unit' => 'kg', 'expiry_date' => '2024-02-08'],
                ['id' => 2, 'name' => 'Лосось', 'quantity' => 1.2, 'unit' => 'kg', 'expiry_date' => '2024-02-09']
            ];
            echo json_encode(['success' => true, 'data' => $items]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Current shift handler
function handleCurrentShift($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $shift = [
                'id' => 1,
                'cashier_name' => 'Иван Петров',
                'start_time' => '2024-01-15 09:00:00',
                'status' => 'open',
                'total_sales' => 12500.00,
                'orders_count' => 45
            ];
            echo json_encode(['success' => true, 'data' => $shift]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Open cashier shift
function handleOpenShift($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $cashInitial = isset($input['cash_initial']) ? floatval($input['cash_initial']) : 0.0;
    $notes = $input['notes'] ?? null;

    $state = getInventoryState();
    $current = [
        'id' => 'shift_' . time(),
        'cash_initial' => $cashInitial,
        'cash_actual' => null,
        'opened_at' => date('c'),
        'notes' => $notes,
        'status' => 'open'
    ];

    $state['cashierCurrentShift'] = $current;
    // ensure history array
    if (!isset($state['cashierShifts']) || !is_array($state['cashierShifts'])) $state['cashierShifts'] = [];
    // Save state
    setInventoryStateKey('cashierCurrentShift', $current);

    // Basic empty report structure
    $report = [
        'total_orders' => 0,
        'total_sales' => 0,
        'total_expenses' => 0,
        'income_by_source' => [
            'cash_at_store' => 0,
            'cash_at_courier' => 0,
            'card_at_store' => 0,
            'card_at_courier' => 0,
            'yandex_eda' => 0,
            'vkusvill' => 0,
            'delivery_club' => 0
        ],
        'expenses_by_category' => [] ,
        'cash_total' => 0,
        'card_total' => 0,
        'aggregators_total' => 0
    ];

    echo json_encode(['success' => true, 'data' => ['shift' => $current, 'report' => $report]]);
}

// Close cashier shift
function handleCloseShift($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $cashActual = isset($input['cash_actual']) ? floatval($input['cash_actual']) : 0.0;
    $notes = $input['notes'] ?? null;

    $state = getInventoryState();
    $current = isset($state['cashierCurrentShift']) ? $state['cashierCurrentShift'] : null;
    if (!$current) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No open shift']);
        return;
    }

    $current['cash_actual'] = $cashActual;
    $current['closed_at'] = date('c');
    $current['notes_close'] = $notes;
    $current['status'] = 'closed';
    $current['cash_difference'] = $cashActual - ($current['cash_initial'] ?? 0);

    // Build a simple report summarizing the shift (minimal values)
    $report = [
        'total_orders' => 0,
        'total_sales' => 0,
        'total_expenses' => 0,
        'income_by_source' => [
            'cash_at_store' => 0,
            'cash_at_courier' => 0,
            'card_at_store' => 0,
            'card_at_courier' => 0,
            'yandex_eda' => 0,
            'vkusvill' => 0,
            'delivery_club' => 0
        ],
        'expenses_by_category' => [],
        'cash_total' => $cashActual,
        'card_total' => 0,
        'aggregators_total' => 0,
        'total_expenses' => 0
    ];

    // Append to history
    $shifts = isset($state['cashierShifts']) && is_array($state['cashierShifts']) ? $state['cashierShifts'] : [];
    $shifts[] = $current;
    setInventoryStateKey('cashierShifts', $shifts);
    // Remove current shift
    $state['cashierCurrentShift'] = null;
    setInventoryStateKey('cashierCurrentShift', null);

    echo json_encode(['success' => true, 'data' => ['shift' => $current, 'report' => $report]]);
}

// Couriers handler
function handleCouriers($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $couriers = [
                ['id' => 1, 'name' => 'Алексей', 'phone' => '+7(999)123-45-67', 'status' => 'active', 'current_order' => null],
                ['id' => 2, 'name' => 'Дмитрий', 'phone' => '+7(999)123-45-68', 'status' => 'busy', 'current_order' => '#1029'],
                ['id' => 3, 'name' => 'Сергей', 'phone' => '+7(999)123-45-69', 'status' => 'offline', 'current_order' => null]
            ];
            echo json_encode(['success' => true, 'data' => $couriers]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Courier deliveries handler
function handleCourierDeliveries($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $deliveries = [
                ['id' => 1, 'courier_id' => 1, 'order_id' => 1029, 'status' => 'delivering', 'start_time' => '2024-01-15 14:30:00'],
                ['id' => 2, 'courier_id' => 2, 'order_id' => 1028, 'status' => 'delivered', 'start_time' => '2024-01-15 13:15:00', 'end_time' => '2024-01-15 14:00:00']
            ];
            echo json_encode(['success' => true, 'data' => $deliveries]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Mercury batches handler
function handleMercuryBatches($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $batches = [
                [
                    'id' => 1,
                    'product_name' => 'Лосось свежий',
                    'batch_number' => 'LS-2024-001',
                    'quantity' => 5.2,
                    'unit' => 'кг',
                    'production_date' => '2024-01-10',
                    'expiry_date' => '2024-01-20',
                    'supplier' => 'ООО "Рыбный мир"',
                    'status' => 'active',
                    'guid' => '123e4567-e89b-12d3-a456-426614174000'
                ],
                [
                    'id' => 2,
                    'product_name' => 'Мясо говядина',
                    'batch_number' => 'MG-2024-002',
                    'quantity' => 12.5,
                    'unit' => 'кг',
                    'production_date' => '2024-01-12',
                    'expiry_date' => '2024-01-22',
                    'supplier' => 'ООО "Мясокомбинат"',
                    'status' => 'redeemed',
                    'guid' => '123e4567-e89b-12d3-a456-426614174001'
                ]
            ];
            echo json_encode(['success' => true, 'data' => $batches]);
            break;
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                if (!is_array($input)) $input = [];

                $state = getInventoryState();
                $batchesState = isset($state['mercuryBatches']) && is_array($state['mercuryBatches']) ? $state['mercuryBatches'] : [];

                $newId = 1;
                if (!empty($batchesState)) {
                    $ids = array_map(function($b) { return isset($b['id']) ? intval($b['id']) : 0; }, $batchesState);
                    $newId = max($ids) + 1;
                }

                $batch = array_merge([
                    'id' => $newId,
                    'product_name' => $input['product_name'] ?? '',
                    'batch_number' => $input['batch_number'] ?? '',
                    'quantity' => isset($input['quantity']) ? floatval($input['quantity']) : 0,
                    'unit' => $input['unit'] ?? 'шт',
                    'production_date' => $input['production_date'] ?? null,
                    'expiry_date' => $input['expiry_date'] ?? null,
                    'supplier' => $input['supplier'] ?? '',
                    'status' => $input['status'] ?? 'active',
                    'guid' => $input['guid'] ?? uniqid('guid_', true)
                ], $input);

                $batchesState[] = $batch;
                $state['mercuryBatches'] = $batchesState;
                setInventoryStateKey('mercuryBatches', $batchesState);

                echo json_encode(['success' => true, 'data' => $batch]);
            } catch (Exception $e) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Mercury documents handler
function handleMercuryDocuments($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $documents = [
                [
                    'id' => 1,
                    'type' => 'VSD',
                    'number' => 'ВСД-001',
                    'date' => '2024-01-15',
                    'supplier' => 'ООО "Рыбный мир"',
                    'status' => 'received',
                    'batches_count' => 3
                ],
                [
                    'id' => 2,
                    'type' => 'VSD',
                    'number' => 'ВСД-002',
                    'date' => '2024-01-14',
                    'supplier' => 'ООО "Мясокомбинат"',
                    'status' => 'processing',
                    'batches_count' => 5
                ]
            ];
            echo json_encode(['success' => true, 'data' => $documents]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// EDO config handler
function handleEDOConfig($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'GET') {
        // Читаем конфигурацию из базы данных
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");
            
            $stmt = $pdo->prepare("SELECT value FROM settings WHERE key = 'diadoc_config'");
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $config = $row ? json_decode($row['value'], true) : null;
            $diadocConfigured = $config && !empty($config['api_key']) && !empty($config['box_id']);
            
            // ✅ Проверяем реальное подключение к Диадок API
            $connectionTest = null;
            if ($diadocConfigured) {
                try {
                    $apiKey = $config['api_key'];
                    $boxId = $config['box_id'];
                    
                    // Тестовый запрос - получаем информацию о ящике
                    $ch = curl_init();
                    curl_setopt_array($ch, [
                        CURLOPT_URL => "https://diadoc-api.kontur.ru/GetBox?boxId=" . urlencode($boxId),
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_HTTPHEADER => [
                            'Authorization: DiadocAuth ddauth_api_client_id=' . urlencode($apiKey),
                            'Content-Type: application/json'
                        ],
                        CURLOPT_TIMEOUT => 5,
                        CURLOPT_SSL_VERIFYPEER => true
                    ]);
                    
                    $response = curl_exec($ch);
                    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);
                    
                    $connectionTest = [
                        'success' => $httpCode === 200,
                        'httpCode' => $httpCode,
                        'message' => $httpCode === 200 ? 'Подключение успешно' : 'Ошибка подключения'
                    ];
                } catch (Exception $e) {
                    $connectionTest = [
                        'success' => false,
                        'error' => $e->getMessage()
                    ];
                }
            }
            
            echo json_encode([
                'ok' => true,
                'diadocConfigured' => $diadocConfigured,
                'boxId' => $config && isset($config['box_id']) ? substr($config['box_id'], 0, 6) . '…' : null,
                'connectionTest' => $connectionTest
            ]);
        } catch (Exception $e) {
            echo json_encode([
                'ok' => true,
                'diadocConfigured' => false
            ]);
        }
    } elseif ($method === 'POST') {
        // Сохраняем конфигурацию
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Неверный формат данных']);
            return;
        }
        
        $config = [
            'api_key' => $input['api_key'] ?? '',
            'box_id' => $input['box_id'] ?? '',
            'inn' => $input['inn'] ?? '',
            'updated_at' => date('Y-m-d H:i:s')
        ];
        
        try {
            // Создаем таблицу settings если её нет
            $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");
            
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('diadoc_config', ?, datetime('now'))");
            $stmt->execute([json_encode($config, JSON_UNESCAPED_UNICODE)]);
            
            echo json_encode([
                'ok' => true,
                'message' => 'Конфигурация Диадока сохранена',
                'diadocConfigured' => !empty($config['api_key']) && !empty($config['box_id'])
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить конфигурацию: ' . $e->getMessage()]);
        }
    } else {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    }
}

// -----------------------------
// Diadoc helpers (PHP EDO mode)
// -----------------------------
function loadDiadocConfigFromSettings($pdo) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");
        $stmt = $pdo->prepare("SELECT value FROM settings WHERE key = 'diadoc_config'");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $config = $row ? json_decode($row['value'], true) : null;
        if (!$config || empty($config['api_key']) || empty($config['box_id'])) {
            return null;
        }
        return $config;
    } catch (Exception $e) {
        return null;
    }
}

function diadocAuthHeaderFromConfig($config) {
    // Используем client_id формат (как в check-diadoc.php и /edo/config тесте)
    $apiKey = $config['api_key'] ?? '';
    return 'Authorization: DiadocAuth ddauth_api_client_id=' . urlencode($apiKey);
}

function diadocCurlRequest($method, $url, $headers = [], $body = null, $timeoutSeconds = 12, $binary = false) {
    $ch = curl_init();
    $opts = [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeoutSeconds,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers
    ];
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = $body;
    }
    if ($binary) {
        // Вернуть "сырые" байты (XML/zip/etc)
        $opts[CURLOPT_BINARYTRANSFER] = true;
    }
    curl_setopt_array($ch, $opts);
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    return [$httpCode, $resp, $curlError];
}

function ensureDiadocInvoiceTables($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS invoice_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT,
        source_filename TEXT,
        doc_number TEXT,
        doc_date TEXT,
        supplier_name TEXT,
        supplier_inn TEXT,
        supplier_kpp TEXT,
        buyer_name TEXT,
        buyer_inn TEXT,
        buyer_kpp TEXT,
        total NUMERIC,
        currency TEXT DEFAULT 'RUB',
        is_paid BOOLEAN DEFAULT 0,
        raw_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    try {
        $pdo->exec("ALTER TABLE invoice_documents ADD COLUMN receipt_document_id TEXT");
    } catch (Exception $e) {
        // колонка уже существует
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS invoice_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_document_id INTEGER NOT NULL,
        line_index INTEGER NOT NULL,
        name TEXT,
        sku_external TEXT,
        gtin TEXT,
        unit TEXT,
        quantity_purchase NUMERIC,
        purchase_price NUMERIC,
        vat_rate TEXT,
        total_with_vat NUMERIC,
        account_code TEXT,
        category_name TEXT,
        sku_internal TEXT,
        unit_coeff NUMERIC DEFAULT 1,
        matched_product_id INTEGER,
        match_score NUMERIC,
        raw_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_document_id) REFERENCES invoice_documents(id) ON DELETE CASCADE
    )");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_invoice_lines_doc ON invoice_lines(invoice_document_id)");
}

function diadocSniffXmlEncoding($bytes) {
    $head = substr($bytes, 0, 256);
    if (preg_match('/encoding\s*=\s*[\"\']([^\"\']+)[\"\']/i', $head, $m)) {
        return strtolower(trim($m[1]));
    }
    return null;
}

function diadocDecodeXmlToUtf8($bytes) {
    $enc = diadocSniffXmlEncoding($bytes);
    if (!$enc) {
        $utf = @mb_convert_encoding($bytes, 'UTF-8', 'UTF-8');
        return $utf !== false ? $utf : $bytes;
    }
    if (strpos($enc, '1251') !== false || strpos($enc, 'windows-1251') !== false || strpos($enc, 'win-1251') !== false || strpos($enc, 'cp1251') !== false) {
        $out = @iconv('Windows-1251', 'UTF-8//IGNORE', $bytes);
        return $out !== false ? $out : $bytes;
    }
    if (strpos($enc, 'utf-8') !== false || strpos($enc, 'utf8') !== false) {
        return $bytes;
    }
    $out = @iconv($enc, 'UTF-8//IGNORE', $bytes);
    return $out !== false ? $out : $bytes;
}

function diadocExtractXmlFiles($originalName, $bytes) {
    $nameLower = strtolower((string)$originalName);
    if (substr($nameLower, -4) !== '.zip') {
        return [[
            'filename' => $originalName ?: 'upload.xml',
            'bytes' => $bytes
        ]];
    }

    $tmp = tempnam(sys_get_temp_dir(), 'diadoc_zip_');
    file_put_contents($tmp, $bytes);
    $zip = new ZipArchive();
    $opened = $zip->open($tmp);
    if ($opened !== true) {
        @unlink($tmp);
        throw new Exception('Не удалось открыть ZIP архив');
    }

    $files = [];
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $stat = $zip->statIndex($i);
        $entryName = $stat['name'] ?? '';
        if (!$entryName) continue;
        if (substr(strtolower($entryName), -4) !== '.xml') continue;
        $data = $zip->getFromIndex($i);
        if ($data === false) continue;
        $files[] = [
            'filename' => $entryName,
            'bytes' => $data
        ];
    }
    $zip->close();
    @unlink($tmp);
    return $files;
}

function diadocDomFirstAttrValue($node, $attrName) {
    if (!$node || !($node instanceof DOMNode)) return '';
    if ($node->attributes && $node->attributes->getNamedItem($attrName)) {
        return trim((string)$node->attributes->getNamedItem($attrName)->nodeValue);
    }
    if ($node->hasChildNodes()) {
        foreach ($node->childNodes as $child) {
            $val = diadocDomFirstAttrValue($child, $attrName);
            if ($val !== '') return $val;
        }
    }
    return '';
}

function diadocParseOnNschfdopprXml($xmlBytesUtf8) {
    $dom = new DOMDocument();
    $prev = libxml_use_internal_errors(true);
    $ok = $dom->loadXML($xmlBytesUtf8);
    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    if (!$ok) {
        throw new Exception('Не удалось распарсить XML');
    }
    $xp = new DOMXPath($dom);

    $tableNodes = $xp->query("//*[local-name()='ТаблСчФакт']");
    if (!$tableNodes || $tableNodes->length === 0) {
        return ['ok' => false, 'reason' => 'no_table', 'meta' => new stdClass(), 'lines' => []];
    }
    $table = $tableNodes->item(0);

    $meta = [
        'number' => diadocDomFirstAttrValue($dom->documentElement, 'НомерСчФ'),
        'date' => diadocDomFirstAttrValue($dom->documentElement, 'ДатаСчФ'),
        'supplier_name' => '',
        'supplier_inn' => '',
        'supplier_kpp' => '',
        'buyer_name' => '',
        'buyer_inn' => '',
        'buyer_kpp' => ''
    ];

    if ($meta['number'] === '') {
        $meta['number'] = diadocDomFirstAttrValue($dom->documentElement, 'НомерДок');
    }
    if ($meta['date'] === '') {
        $meta['date'] = diadocDomFirstAttrValue($dom->documentElement, 'ДатаДок');
    }

    $sellerNodes = $xp->query("//*[local-name()='СвПрод']");
    if ($sellerNodes && $sellerNodes->length > 0) {
        $seller = $sellerNodes->item(0);
        $meta['supplier_name'] = diadocDomFirstAttrValue($seller, 'НаимОрг');
        $meta['supplier_inn'] = diadocDomFirstAttrValue($seller, 'ИНН');
        $meta['supplier_kpp'] = diadocDomFirstAttrValue($seller, 'КПП');
    }

    $buyerNodes = $xp->query("//*[local-name()='СвПокуп']");
    if ($buyerNodes && $buyerNodes->length > 0) {
        $buyer = $buyerNodes->item(0);
        $meta['buyer_name'] = diadocDomFirstAttrValue($buyer, 'НаимОрг');
        $meta['buyer_inn'] = diadocDomFirstAttrValue($buyer, 'ИНН');
        $meta['buyer_kpp'] = diadocDomFirstAttrValue($buyer, 'КПП');
    }

    $lineNodes = $xp->query(".//*[local-name()='СведТов']", $table);
    $lines = [];
    $index = 0;
    if ($lineNodes) {
        foreach ($lineNodes as $lineNode) {
            $index++;
            $extraNodes = $xp->query(".//*[local-name()='ДопСведТов']", $lineNode);
            $extra = ($extraNodes && $extraNodes->length > 0) ? $extraNodes->item(0) : null;

            $name = trim((string)($lineNode->attributes?->getNamedItem('НаимТов')?->nodeValue ?? ''));
            $skuExternal = trim((string)($lineNode->attributes?->getNamedItem('КодТов')?->nodeValue ?? ''));
            if ($skuExternal === '' && $extra) {
                $skuExternal = trim((string)($extra->attributes?->getNamedItem('КодТов')?->nodeValue ?? ''));
            }
            $gtin = $extra ? trim((string)($extra->attributes?->getNamedItem('ГТИН')?->nodeValue ?? '')) : '';
            $unit = trim((string)($lineNode->attributes?->getNamedItem('НаимЕдИзм')?->nodeValue ?? ''));
            if ($unit === '') {
                $unit = trim((string)($lineNode->attributes?->getNamedItem('ОКЕИ_Тов')?->nodeValue ?? ''));
            }

            $qty = (float)str_replace(',', '.', (string)($lineNode->attributes?->getNamedItem('КолТов')?->nodeValue ?? '0'));
            $price = (float)str_replace(',', '.', (string)($lineNode->attributes?->getNamedItem('ЦенаТов')?->nodeValue ?? '0'));
            $vat = trim((string)($lineNode->attributes?->getNamedItem('НалСт')?->nodeValue ?? ''));
            $total = (float)str_replace(',', '.', (string)($lineNode->attributes?->getNamedItem('СтТовУчНал')?->nodeValue ?? '0'));

            $lines[] = [
                'line_index' => $index,
                'name' => $name,
                'sku_external' => $skuExternal,
                'gtin' => $gtin,
                'unit' => $unit,
                'quantity_purchase' => $qty,
                'purchase_price' => $price,
                'vat_rate' => $vat,
                'total_with_vat' => $total,
                'raw' => null
            ];
        }
    }

    return ['ok' => true, 'format' => 'ON_NSCHFDOPPR', 'meta' => $meta, 'lines' => $lines];
}

function diadocFindBestProductMatch($products, $line) {
    $sku = trim((string)($line['sku_external'] ?? ''));
    $gtin = trim((string)($line['gtin'] ?? ''));
    $name = mb_strtolower(trim((string)($line['name'] ?? '')));

    $best = ['product_id' => null, 'score' => 0];
    foreach ($products as $p) {
        $pid = $p['id'] ?? null;
        $article = (string)($p['article'] ?? '');
        $barcode = (string)($p['barcode'] ?? '');
        if ($sku !== '' && $article !== '' && $sku === $article) {
            return ['product_id' => $pid, 'score' => 1];
        }
        if ($gtin !== '' && $barcode !== '' && $gtin === $barcode) {
            return ['product_id' => $pid, 'score' => 1];
        }
    }

    if ($name === '') {
        return $best;
    }

    foreach ($products as $p) {
        $pid = $p['id'] ?? null;
        $pname = mb_strtolower((string)($p['name'] ?? ''));
        if ($pname === '') continue;
        $dist = levenshtein($name, $pname);
        $len = max(mb_strlen($name), mb_strlen($pname));
        $score = $len > 0 ? (1 - ($dist / $len)) : 0;
        if ($score > $best['score']) {
            $best = ['product_id' => $pid, 'score' => $score];
        }
    }
    if ($best['score'] < 0.6) {
        return ['product_id' => null, 'score' => $best['score']];
    }
    return $best;
}

function handleDiadocImportPreview($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }

    requireAdminAccessIfConfigured($pdo);

    if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Файл не загружен']);
        return;
    }

    $originalName = $_FILES['file']['name'] ?? 'upload';
    $bytes = file_get_contents($_FILES['file']['tmp_name']);
    if ($bytes === false) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Не удалось прочитать файл']);
        return;
    }

    $xmlFiles = diadocExtractXmlFiles($originalName, $bytes);

    $products = [];
    try {
        $stmt = $pdo->query("SELECT id, name, barcode, article FROM products");
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $products = [];
    }

    $documents = [];
    foreach ($xmlFiles as $file) {
        $decoded = diadocDecodeXmlToUtf8($file['bytes']);
        $parsed = diadocParseOnNschfdopprXml($decoded);
        if (!($parsed['ok'] ?? false) || empty($parsed['lines'])) {
            continue;
        }
        $docTotal = 0;
        $lines = [];
        foreach ($parsed['lines'] as $ln) {
            $match = diadocFindBestProductMatch($products, $ln);
            $ln['matched_product_id'] = $match['product_id'];
            $ln['match_score'] = $match['score'];
            $docTotal += floatval($ln['total_with_vat'] ?? 0);
            $lines[] = $ln;
        }
        $documents[] = [
            'filename' => $file['filename'],
            'format' => $parsed['format'] ?? 'ON_NSCHFDOPPR',
            'meta' => $parsed['meta'] ?? new stdClass(),
            'total' => $docTotal,
            'currency' => 'RUB',
            'lines' => $lines
        ];
    }

    echo json_encode([
        'ok' => true,
        'documents' => $documents,
        'total' => count($documents)
    ], JSON_UNESCAPED_UNICODE);
}

function handleDiadocImportApply($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }

    requireAdminAccessIfConfigured($pdo);
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['document']) || !isset($input['lines']) || !is_array($input['lines'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Некорректный payload']);
        return;
    }

    $doc = $input['document'];
    $meta = $doc['meta'] ?? [];
    $sourceFilename = $doc['filename'] ?? null;
    $warehouseId = $doc['warehouseId'] ?? $doc['warehouse_id'] ?? $doc['warehouse'] ?? null;
    $postReceipt = !empty($doc['post_receipt']) || !empty($doc['post']);

    $pdo->beginTransaction();
    try {
        $computedTotal = 0;
        foreach ($input['lines'] as $line) {
            $computedTotal += floatval($line['total_with_vat'] ?? 0);
        }

        $stmt = $pdo->prepare("INSERT INTO invoice_documents
            (source, source_filename, doc_number, doc_date, supplier_name, supplier_inn, supplier_kpp, buyer_name, buyer_inn, buyer_kpp, total, currency, is_paid, raw_json, created_at, updated_at)
            VALUES
            (:source, :source_filename, :doc_number, :doc_date, :supplier_name, :supplier_inn, :supplier_kpp, :buyer_name, :buyer_inn, :buyer_kpp, :total, :currency, :is_paid, :raw_json, datetime('now'), datetime('now'))");
        $stmt->execute([
            ':source' => 'diadoc_file',
            ':source_filename' => $sourceFilename,
            ':doc_number' => $meta['number'] ?? null,
            ':doc_date' => $meta['date'] ?? null,
            ':supplier_name' => $meta['supplier_name'] ?? null,
            ':supplier_inn' => $meta['supplier_inn'] ?? null,
            ':supplier_kpp' => $meta['supplier_kpp'] ?? null,
            ':buyer_name' => $meta['buyer_name'] ?? null,
            ':buyer_inn' => $meta['buyer_inn'] ?? null,
            ':buyer_kpp' => $meta['buyer_kpp'] ?? null,
            ':total' => $doc['total'] ?? $computedTotal,
            ':currency' => $doc['currency'] ?? 'RUB',
            ':is_paid' => !empty($doc['is_paid']) ? 1 : 0,
            ':raw_json' => json_encode($doc, JSON_UNESCAPED_UNICODE)
        ]);
        $invoiceId = (int)$pdo->lastInsertId();

        $lineStmt = $pdo->prepare("INSERT INTO invoice_lines
            (invoice_document_id, line_index, name, sku_external, gtin, unit, quantity_purchase, purchase_price, vat_rate, total_with_vat,
             account_code, category_name, sku_internal, unit_coeff, matched_product_id, match_score, raw_json, created_at)
            VALUES
            (:invoice_document_id, :line_index, :name, :sku_external, :gtin, :unit, :quantity_purchase, :purchase_price, :vat_rate, :total_with_vat,
             :account_code, :category_name, :sku_internal, :unit_coeff, :matched_product_id, :match_score, :raw_json, datetime('now'))");

        $i = 0;
        foreach ($input['lines'] as $line) {
            $i++;
            $lineStmt->execute([
                ':invoice_document_id' => $invoiceId,
                ':line_index' => $line['line_index'] ?? $i,
                ':name' => $line['name'] ?? null,
                ':sku_external' => $line['sku_external'] ?? null,
                ':gtin' => $line['gtin'] ?? null,
                ':unit' => $line['unit'] ?? null,
                ':quantity_purchase' => $line['quantity_purchase'] ?? null,
                ':purchase_price' => $line['purchase_price'] ?? null,
                ':vat_rate' => $line['vat_rate'] ?? null,
                ':total_with_vat' => $line['total_with_vat'] ?? null,
                ':account_code' => $line['account_code'] ?? null,
                ':category_name' => $line['category_name'] ?? null,
                ':sku_internal' => $line['sku_internal'] ?? null,
                ':unit_coeff' => $line['unit_coeff'] ?? 1,
                ':matched_product_id' => $line['matched_product_id'] ?? null,
                ':match_score' => $line['match_score'] ?? null,
                ':raw_json' => json_encode($line, JSON_UNESCAPED_UNICODE)
            ]);
        }

        $receiptLines = [];
        foreach ($input['lines'] as $line) {
            $qty = floatval($line['quantity_purchase'] ?? 0);
            $coeff = floatval($line['unit_coeff'] ?? 1);
            if ($coeff <= 0) $coeff = 1;
            $productQty = $qty * $coeff;
            $receiptLines[] = [
                'productId' => $line['matched_product_id'] ?? null,
                'name' => $line['name'] ?? null,
                'qty' => $productQty,
                'unit' => $line['unit'] ?? null,
                'purchasePrice' => $line['purchase_price'] ?? null,
                'vatRate' => $line['vat_rate'] ?? null,
                'accountCode' => $line['account_code'] ?? null,
                'category' => $line['category_name'] ?? null,
                'skuExternal' => $line['sku_external'] ?? null,
                'skuInternal' => $line['sku_internal'] ?? null,
                'source' => 'diadoc',
                'invoice_document_id' => $invoiceId
            ];
        }

        $receiptDoc = createInventoryDocument([
            'type' => 'receipt',
            'status' => $postReceipt ? 'posted' : 'draft',
            'docType' => 'receipt',
            'docNumber' => $meta['number'] ?? ('INV-' . $invoiceId),
            'number' => $meta['number'] ?? ('INV-' . $invoiceId),
            'docDate' => $meta['date'] ?? date('c'),
            'date' => $meta['date'] ?? date('c'),
            'warehouseId' => $warehouseId,
            'warehouse' => $warehouseId,
            'lines' => $receiptLines,
            'items' => $receiptLines,
            'totalAmount' => $doc['total'] ?? $computedTotal,
            'total' => $doc['total'] ?? $computedTotal,
            'supplier' => $meta['supplier_name'] ?? null,
            'counterparty' => $meta['supplier_name'] ?? null,
            'source' => 'diadoc_import',
            'invoice_document_id' => $invoiceId
        ]);

        if (($receiptDoc['status'] ?? null) === 'posted') {
            applyReceiptDocumentToInventoryBalances($pdo, $receiptDoc);
        }

        try {
            $upd = $pdo->prepare("UPDATE invoice_documents SET receipt_document_id = ?, updated_at = datetime('now') WHERE id = ?");
            $upd->execute([$receiptDoc['id'] ?? null, $invoiceId]);
        } catch (Exception $e) {
            // ignore
        }

        $pdo->commit();
        echo json_encode([
            'ok' => true,
            'invoice_document_id' => $invoiceId,
            'receipt_document_id' => $receiptDoc['id'] ?? null,
            'receipt_status' => $receiptDoc['status'] ?? null
        ], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить накладную', 'details' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
}

function ensureInventoryBalancesTable($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS inventory_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        warehouse_id INTEGER DEFAULT 1,
        quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
        unit TEXT DEFAULT 'шт',
        purchase_price DECIMAL(10,2),
        vat_rate TEXT,
        batch_number TEXT,
        expiry_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )");
}

function recalcProductCostFromBalances($pdo, $productId) {
    $stmt = $pdo->prepare("SELECT SUM(quantity) as qty_sum, SUM(quantity * purchase_price) as cost_sum
        FROM inventory_balances
        WHERE product_id = ? AND quantity > 0 AND purchase_price IS NOT NULL");
    $stmt->execute([$productId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $qtySum = floatval($row['qty_sum'] ?? 0);
    $costSum = floatval($row['cost_sum'] ?? 0);
    if ($qtySum <= 0) return;
    $avg = $costSum / $qtySum;
    try {
        $upd = $pdo->prepare("UPDATE products SET cost = ? WHERE id = ?");
        $upd->execute([$avg, $productId]);
    } catch (Exception $e) {
        // ignore
    }
}

function applyReceiptDocumentToInventoryBalances($pdo, $receiptDoc) {
    ensureInventoryBalancesTable($pdo);

    $warehouseId = $receiptDoc['warehouseId'] ?? $receiptDoc['warehouse'] ?? 1;
    $warehouseId = intval($warehouseId ?: 1);

    $lines = $receiptDoc['lines'] ?? $receiptDoc['items'] ?? [];
    if (!is_array($lines)) $lines = [];

    $insert = $pdo->prepare("INSERT INTO inventory_balances
        (product_id, warehouse_id, quantity, unit, purchase_price, vat_rate, batch_number, expiry_date, created_at, updated_at)
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))");

    $touched = [];
    $idx = 0;
    foreach ($lines as $line) {
        $idx++;
        $accountCode = normalizeAccountCode($line['accountCode'] ?? $line['account_code'] ?? '');
        if ($accountCode === '43' || $accountCode === '43_mod') {
            continue;
        }
        $productId = intval($line['productId'] ?? $line['product_id'] ?? 0);
        if ($productId <= 0) {
            continue;
        }
        $qty = floatval($line['qty'] ?? $line['quantity'] ?? 0);
        if ($qty == 0) {
            continue;
        }
        $unit = $line['unit'] ?? 'шт';
        $purchasePrice = $line['purchasePrice'] ?? $line['purchase_price'] ?? null;
        $vatRate = $line['vatRate'] ?? $line['vat_rate'] ?? null;
        $batch = $line['batch_number'] ?? $line['batchNumber'] ?? null;
        if (!$batch) {
            $batch = 'RCPT-' . ($receiptDoc['id'] ?? 'doc') . '-' . $idx;
        }
        $expiry = $line['expiry_date'] ?? $line['expiry'] ?? null;

        $insert->execute([
            $productId,
            $warehouseId,
            $qty,
            $unit,
            $purchasePrice,
            $vatRate,
            $batch,
            $expiry
        ]);
        $touched[$productId] = true;
    }

    foreach (array_keys($touched) as $productId) {
        recalcProductCostFromBalances($pdo, $productId);
    }
}

function normalizeInventoryUnit($unit) {
    $u = mb_strtolower(trim((string)$unit));
    $u = str_replace(['.', ' '], '', $u);
    $map = [
        'шт' => 'pcs',
        'штук' => 'pcs',
        'кг' => 'kg',
        'kg' => 'kg',
        'г' => 'g',
        'гр' => 'g',
        'g' => 'g',
        'л' => 'l',
        'l' => 'l',
        'мл' => 'ml',
        'ml' => 'ml',
        'шт' => 'pcs',
        'ш' => 'pcs',
        'pcs' => 'pcs'
    ];
    return $map[$u] ?? $u;
}

function normalizeAccountCode($value) {
    $raw = trim((string)$value);
    if ($raw === '') return '';
    $normalized = strtolower(str_replace([' ', "\t"], '', str_replace(',', '.', $raw)));
    if ($normalized === '10.01') return '10.1';
    if ($normalized === '10.02') return '10.2';
    if ($normalized === '41.01') return '41.1';
    if ($normalized === '43mod') return '43_mod';
    if ($normalized === '43_mod') return '43_mod';
    if ($normalized === '10.1') return '10.1';
    if ($normalized === '10.2') return '10.2';
    if ($normalized === '41.1') return '41.1';
    if ($normalized === '43') return '43';
    return '';
}

function detectCsvDelimiterFromLine($line) {
    $sample = (string)$line;
    $candidates = [',', ';', "\t", '|'];
    $best = ',';
    $bestCount = -1;
    foreach ($candidates as $cand) {
        $count = substr_count($sample, $cand);
        if ($count > $bestCount) {
            $bestCount = $count;
            $best = $cand;
        }
    }
    return $best;
}

function downloadAndProcessImportedImage($url, $productId, $logPath = null) {
    $u = trim((string)$url);
    if ($u === '' || !preg_match('/^https?:\/\//i', $u)) {
        return null;
    }
    $pid = intval($productId);
    if ($pid <= 0) {
        return null;
    }

    $content = null;
    $contentType = '';
    try {
        if (function_exists('curl_init')) {
            $ch = curl_init($u);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
            curl_setopt($ch, CURLOPT_TIMEOUT, 12);
            curl_setopt($ch, CURLOPT_USERAGENT, 'DandyPizzaImporter/1.0');
            $content = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $contentType = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
            curl_close($ch);
            if (!$content || $code < 200 || $code >= 300) {
                $content = null;
            }
        } else {
            $ctx = stream_context_create([
                'http' => [
                    'timeout' => 12,
                    'follow_location' => 1,
                    'header' => "User-Agent: DandyPizzaImporter/1.0\r\n"
                ]
            ]);
            $raw = @file_get_contents($u, false, $ctx);
            if ($raw !== false && $raw !== null && $raw !== '') {
                $content = $raw;
                if (isset($http_response_header) && is_array($http_response_header)) {
                    foreach ($http_response_header as $hdrLine) {
                        if (stripos($hdrLine, 'Content-Type:') === 0) {
                            $contentType = trim(substr($hdrLine, strlen('Content-Type:')));
                            break;
                        }
                    }
                }
            }
        }
    } catch (Exception $e) {
        $content = null;
    }

    if (!$content) {
        return null;
    }

    // Basic sniffing: avoid trying to decode HTML/JSON/etc as images (prevents warnings => 500)
    $sniff = ltrim(substr($content, 0, 64));
    if ($sniff !== '' && ($sniff[0] === '<' || stripos($sniff, '{') === 0 || stripos($sniff, '[') === 0)) {
        if ($logPath) {
            @file_put_contents($logPath, date('Y-m-d H:i:s') . " | Import image is not an image (looks like text/html/json) for product {$pid}: {$u}\n", FILE_APPEND);
        }
        return null;
    }
    if ($contentType !== '' && stripos($contentType, 'image/') !== 0) {
        if ($logPath) {
            @file_put_contents($logPath, date('Y-m-d H:i:s') . " | Import image has non-image Content-Type ({$contentType}) for product {$pid}: {$u}\n", FILE_APPEND);
        }
        return null;
    }

    $uploadDir = __DIR__ . '/../uploads/products/';
    if (!file_exists($uploadDir)) {
        @mkdir($uploadDir, 0777, true);
    }

    $ts = time();
    $baseName = 'product_' . $pid . '_' . $ts;

    $localRel = null;
    $didProcess = false;

    // Try GD resize (keep aspect ratio; no crop)
    try {
        if (function_exists('imagecreatefromstring') && function_exists('imagejpeg') && function_exists('imagecreatetruecolor')) {
            // Prevent global error handler from converting GD warnings into 500+exit
            $prevHandler = set_error_handler(function() {
                return true;
            });
            $src = @imagecreatefromstring($content);
            if ($prevHandler !== null) {
                restore_error_handler();
            } else {
                restore_error_handler();
            }
            if ($src) {
                $srcW = imagesx($src);
                $srcH = imagesy($src);
                if ($srcW > 0 && $srcH > 0) {
                    $maxW = 1600;
                    $maxH = 1600;
                    $scale = 1.0;
                    if ($srcW > $maxW || $srcH > $maxH) {
                        $scaleW = $maxW / $srcW;
                        $scaleH = $maxH / $srcH;
                        $scale = min($scaleW, $scaleH);
                    }
                    $dstW = intval(max(1, floor($srcW * $scale)));
                    $dstH = intval(max(1, floor($srcH * $scale)));

                    $dst = imagecreatetruecolor($dstW, $dstH);
                    imagecopyresampled($dst, $src, 0, 0, 0, 0, $dstW, $dstH, $srcW, $srcH);

                    $fileName = $baseName . '.jpg';
                    $path = $uploadDir . $fileName;
                    if (@imagejpeg($dst, $path, 88)) {
                        $localRel = '/uploads/products/' . $fileName;
                        $didProcess = true;
                    }
                    imagedestroy($dst);
                }
                imagedestroy($src);
            }
        }
    } catch (Exception $e) {
        $didProcess = false;
    }

    if ($didProcess && $localRel) {
        return $localRel;
    }

    // Fallback: save raw as jpg (still local)
    try {
        $ext = '.bin';
        if ($contentType !== '') {
            $ct = strtolower(trim(explode(';', $contentType)[0] ?? ''));
            if ($ct === 'image/jpeg' || $ct === 'image/jpg') $ext = '.jpg';
            else if ($ct === 'image/png') $ext = '.png';
            else if ($ct === 'image/gif') $ext = '.gif';
            else if ($ct === 'image/webp') $ext = '.webp';
        }
        $fileName = $baseName . $ext;
        $path = $uploadDir . $fileName;
        if (@file_put_contents($path, $content) !== false) {
            return '/uploads/products/' . $fileName;
        }
    } catch (Exception $e) {
        if ($logPath) {
            @file_put_contents($logPath, date('Y-m-d H:i:s') . " | Image save failed for product {$pid}: " . $e->getMessage() . "\n", FILE_APPEND);
        }
    }
    return null;
}

function toBaseQuantity($qty, $unit) {
    $u = normalizeInventoryUnit($unit);
    $q = floatval($qty);
    if ($u === 'kg') return ['type' => 'mass', 'value' => $q * 1000.0];
    if ($u === 'g') return ['type' => 'mass', 'value' => $q];
    if ($u === 'l') return ['type' => 'volume', 'value' => $q * 1000.0];
    if ($u === 'ml') return ['type' => 'volume', 'value' => $q];
    return ['type' => 'pcs', 'value' => $q];
}

function convertToTypeQuantity($qty, $fromUnit, $targetType) {
    $base = toBaseQuantity($qty, $fromUnit);
    if ($base['type'] !== $targetType) {
        return null;
    }
    return floatval($base['value']);
}

function inferQuantityTypeFromUnit($unit) {
    $u = normalizeInventoryUnit($unit);
    if ($u === 'kg' || $u === 'g') return 'mass';
    if ($u === 'l' || $u === 'ml') return 'volume';
    return 'pcs';
}

function getProductAvailableBaseQty($pdo, $productId, $warehouseId, $targetType, $fallbackUnit = null) {
    ensureInventoryBalancesTable($pdo);
    $stmt = $pdo->prepare("SELECT quantity, unit FROM inventory_balances WHERE product_id = ? AND warehouse_id = ? AND quantity > 0");
    $stmt->execute([$productId, $warehouseId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $sum = 0.0;
    foreach ($rows as $row) {
        $unit = $row['unit'] ?? $fallbackUnit;
        $converted = convertToTypeQuantity($row['quantity'] ?? 0, $unit, $targetType);
        if ($converted === null) {
            continue;
        }
        $sum += $converted;
    }
    return $sum;
}

function handleInventoryVirtualStock() {
    global $pdo;
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }

    $warehouseId = isset($_GET['warehouseId']) ? intval($_GET['warehouseId']) : 1;
    if ($warehouseId <= 0) $warehouseId = 1;

    $recipes = [];
    try {
        $stmt = $pdo->query("SELECT id, product_id, name, output_quantity, output_unit, ingredients, is_active FROM recipes WHERE is_active = 1 AND product_id IS NOT NULL");
        $recipes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $recipes = [];
    }

    $productIds = [];
    foreach ($recipes as $r) {
        $pid = intval($r['product_id'] ?? 0);
        if ($pid > 0) $productIds[$pid] = true;
    }

    $products = [];
    if (!empty($productIds)) {
        $ids = array_keys($productIds);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("SELECT id, name, type FROM products WHERE id IN ($placeholders)");
        $stmt->execute($ids);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $p) {
            $products[intval($p['id'])] = $p;
        }
    }

    $result = [];
    foreach ($recipes as $r) {
        $dishId = intval($r['product_id'] ?? 0);
        if ($dishId <= 0) continue;
        $dish = $products[$dishId] ?? null;
        if (!$dish) continue;

        $ings = [];
        if (isset($r['ingredients']) && is_string($r['ingredients'])) {
            $decoded = json_decode($r['ingredients'], true);
            if (is_array($decoded)) $ings = $decoded;
        }

        $limits = [];
        $dishAvailable = null;
        foreach ($ings as $ing) {
            $ingProductId = intval($ing['product_id'] ?? $ing['productId'] ?? $ing['id'] ?? 0);
            if ($ingProductId <= 0) continue;
            $reqQty = floatval($ing['quantity'] ?? $ing['qty'] ?? 0);
            if ($reqQty <= 0) continue;
            $reqUnit = $ing['unit'] ?? $ing['unitName'] ?? null;
            $reqBase = toBaseQuantity($reqQty, $reqUnit);
            $availableBase = getProductAvailableBaseQty($pdo, $ingProductId, $warehouseId, $reqBase['type'], $reqUnit);
            $possible = $reqBase['value'] > 0 ? floor($availableBase / floatval($reqBase['value'])) : null;
            if ($possible === null) continue;

            $limits[] = [
                'ingredient_product_id' => $ingProductId,
                'required_qty' => $reqQty,
                'required_unit' => $reqUnit,
                'available_base' => $availableBase,
                'required_base' => floatval($reqBase['value']),
                'base_type' => $reqBase['type'],
                'possible' => intval($possible)
            ];

            if ($dishAvailable === null || $possible < $dishAvailable) {
                $dishAvailable = intval($possible);
            }
        }

        $result[] = [
            'dish_product_id' => $dishId,
            'dish_name' => $dish['name'] ?? ($r['name'] ?? ''),
            'recipe_id' => intval($r['id'] ?? 0),
            'warehouse_id' => $warehouseId,
            'virtual_available' => $dishAvailable === null ? 0 : $dishAvailable,
            'limits' => $limits
        ];
    }

    echo json_encode(['ok' => true, 'data' => $result, 'warehouseId' => $warehouseId], JSON_UNESCAPED_UNICODE);
}

// EDO inventory handler
function handleEDOInventory($pdo) {
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $path = str_replace('/api/', '', $path);
    $path = ltrim($path, '/');
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $path === 'edo/inventory/products') {
        // Возвращаем список товаров из базы
        try {
            $stmt = $pdo->query("SELECT id, name, type, barcode, article, price, cost FROM products ORDER BY name");
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $formatted = array_map(function($p) {
                return [
                    'id' => $p['id'],
                    'name' => $p['name'],
                    'type' => $p['type'] ?? 'product',
                    'barcode' => $p['barcode'] ?? '',
                    'article' => $p['article'] ?? '',
                    'synonyms' => [],
                    'vatRate' => '20%'
                ];
            }, $products);
            
            echo json_encode(['ok' => true, 'products' => $formatted]);
        } catch (Exception $e) {
            echo json_encode(['ok' => true, 'products' => []]);
        }
    } else {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Not found']);
    }
}

// EDO documents handler
function handleEDODocuments($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            // Формат для admin-edo-module.js: { ok: true, docs: [...] }
            $config = loadDiadocConfigFromSettings($pdo);
            if (!$config) {
                // Демо-режим (конфиг не задан)
                echo json_encode([
                    'ok' => true,
                    'docs' => [
                [
                            'docflowId' => 'demo-001',
                            'type' => 'UniversalTransferDocument',
                            'status' => 'incoming',
                    'counterparty' => 'ООО "Поставщик продуктов"',
                            'date' => '2024-01-15T00:00:00Z',
                            'total' => 25000,
                            'number' => 'УПД-001'
                        ]
                    ],
                    'demo' => true
                ], JSON_UNESCAPED_UNICODE);
                return;
            }

            $boxId = $config['box_id'];
            $apiBase = 'https://diadoc-api.kontur.ru';
            $url = $apiBase . '/SearchDocflows?boxId=' . urlencode($boxId) . '&count=50';
            $payload = json_encode(['filter' => ['counteragentBoxId' => null]], JSON_UNESCAPED_UNICODE);
            $headers = [
                diadocAuthHeaderFromConfig($config),
                'Content-Type: application/json'
            ];
            list($code, $body, $err) = diadocCurlRequest('POST', $url, $headers, $payload, 15, false);
            if ($code !== 200 || !$body) {
                echo json_encode([
                    'ok' => true,
                    'docs' => [],
                    'cached' => false,
                    'warning' => 'Не удалось получить документы из Диадока (будет демо/пусто)',
                    'httpCode' => $code
                ], JSON_UNESCAPED_UNICODE);
                return;
            }

            $json = json_decode($body, true);
            $docflows = $json['Docflows'] ?? [];
            $docs = [];
            foreach ($docflows as $flow) {
                $docflowId = $flow['DocflowId'] ?? $flow['DocflowID'] ?? $flow['docflowId'] ?? null;
                $documents = $flow['Documents'] ?? [];
                $firstDoc = is_array($documents) && count($documents) ? $documents[0] : [];
                $docs[] = [
                    'docflowId' => $docflowId,
                    'type' => $firstDoc['DocumentType'] ?? $firstDoc['TypeNamedId'] ?? ($flow['DocumentType'] ?? 'UniversalTransferDocument'),
                    'status' => $flow['DocflowStatus'] ?? $flow['Status'] ?? 'incoming',
                    'counterparty' => $flow['CounterpartyName'] ?? $flow['CounteragentBoxId'] ?? ($flow['CounterpartyBoxId'] ?? 'Контрагент'),
                    'counterpartyBoxId' => $flow['CounteragentBoxId'] ?? $flow['CounterpartyBoxId'] ?? null,
                    'date' => $flow['SendDateTime'] ?? $flow['Date'] ?? $flow['CreatedAt'] ?? date('c'),
                    'total' => $firstDoc['TotalAmount'] ?? $flow['TotalAmount'] ?? null,
                    'number' => $firstDoc['DocumentNumber'] ?? $flow['DocumentNumber'] ?? ''
                ];
            }

            echo json_encode(['ok' => true, 'docs' => $docs, 'demo' => false], JSON_UNESCAPED_UNICODE);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    }
}

// EDO document sync handler
function handleEDODocumentSync($pdo, $docflowId) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    // Загружаем конфигурацию
    try {
        $stmt = $pdo->prepare("SELECT value FROM settings WHERE key = 'diadoc_config'");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $config = $row ? json_decode($row['value'], true) : null;
        
        if (!$config || empty($config['api_key']) || empty($config['box_id'])) {
            echo json_encode([
                'ok' => true,
                'doc' => null,
                'refreshed' => false,
                'warning' => 'Диадок не настроен. Используйте демо-режим.'
            ]);
            return;
        }
    } catch (Exception $e) {
        echo json_encode([
            'ok' => true,
            'doc' => null,
            'refreshed' => false,
            'warning' => 'Не удалось загрузить конфигурацию.'
        ]);
        return;
    }
    
    // В реальной реализации здесь был бы запрос к API Диадока
    // Пока возвращаем успешный ответ
    echo json_encode([
        'ok' => true,
        'doc' => [
            'docflowId' => $docflowId,
            'status' => 'incoming',
            'refreshed' => true
        ],
        'refreshed' => true
    ]);
}

// EDO document sign handler
function handleEDODocumentSign($pdo, $docflowId) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    // В реальной реализации здесь была бы подпись через API Диадока
    echo json_encode([
        'ok' => true,
        'status' => 'signed',
        'message' => 'Документ помечен как подписанный (демо-режим)'
    ]);
}

// EDO document send handler
function handleEDODocumentSend($pdo, $docflowId) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    // В реальной реализации здесь была бы отправка через API Диадока
    echo json_encode([
        'ok' => true,
        'status' => 'sent',
        'message' => 'Документ помечен как отправленный (демо-режим)'
    ]);
}

// EDO document reject handler
function handleEDODocumentReject($pdo, $docflowId) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $reason = $input['reason'] ?? 'Отказ';
    
    // В реальной реализации здесь была бы отправка отказа через API Диадока
    echo json_encode([
        'ok' => true,
        'status' => 'rejected',
        'message' => 'Отказ отправлен (демо-режим)',
        'reason' => $reason
    ]);
}

// EDO document parse handler
function handleEDODocumentParse($pdo, $docflowId) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    $config = loadDiadocConfigFromSettings($pdo);
    if (!$config) {
        // демо
        echo json_encode([
            'ok' => true,
            'items' => [
        [
            'name' => 'Сыр Моцарелла 45%',
            'quantity' => 10,
            'unitName' => 'кг',
            'price' => 820,
            'subtotal' => 8200,
            'vatRate' => '20%',
            'barcode' => '4601234000017',
            'article' => 'MOZ45'
        ]
            ],
            'xml' => '<demo>true</demo>',
            'demo' => true
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    $apiBase = 'https://diadoc-api.kontur.ru';
    $boxId = $config['box_id'];
    $headers = [diadocAuthHeaderFromConfig($config)];

    // 1) GetDocflows -> найдём document + entity (UTD/TORG12)
    $docflowUrl = $apiBase . '/GetDocflows?boxId=' . urlencode($boxId) . '&docflowId=' . urlencode($docflowId);
    list($code1, $body1, $err1) = diadocCurlRequest('GET', $docflowUrl, $headers, null, 15, false);
    if ($code1 !== 200 || !$body1) {
        echo json_encode(['ok' => false, 'error' => 'Не удалось получить Docflow из Диадока', 'httpCode' => $code1], JSON_UNESCAPED_UNICODE);
        return;
    }
    $docflowJson = json_decode($body1, true);
    $documents = $docflowJson['Docflow']['Documents'] ?? [];
    $document = is_array($documents) && count($documents) ? $documents[0] : null;
    if (!$document) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Документ не найден'], JSON_UNESCAPED_UNICODE);
        return;
    }
    $entities = $document['Entities'] ?? [];
    $entity = null;
    foreach ($entities as $e) {
        $t = $e['AttachmentType'] ?? '';
        if ($t === 'XmlTorg12' || $t === 'UniversalTransferDocument') {
            $entity = $e;
            break;
        }
    }
    if (!$entity) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Титул продавца не найден'], JSON_UNESCAPED_UNICODE);
        return;
    }

    // 2) GetEntityContent -> raw xml
    $messageId = $document['MessageId'] ?? '';
    $entityId = $entity['EntityId'] ?? '';
    if (!$messageId || !$entityId) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Нет MessageId/EntityId в Docflow'], JSON_UNESCAPED_UNICODE);
        return;
    }
    $contentUrl = $apiBase . '/GetEntityContent?boxId=' . urlencode($boxId) . '&messageId=' . urlencode($messageId) . '&entityId=' . urlencode($entityId);
    list($code2, $xmlRaw, $err2) = diadocCurlRequest('GET', $contentUrl, $headers, null, 20, true);
    if ($code2 !== 200 || !$xmlRaw) {
        echo json_encode(['ok' => false, 'error' => 'Не удалось получить XML из Диадока', 'httpCode' => $code2], JSON_UNESCAPED_UNICODE);
        return;
    }

    // 3) ParseTitleXml -> parsed xml with table items
    $docTypeNamedId = $entity['AttachmentType'];
    $docVersion = $entity['Version'] ?? 'utd970_05_03_01';
    $parseUrl = $apiBase . '/ParseTitleXml?boxId=' . urlencode($boxId) .
        '&documentTypeNamedId=' . urlencode($docTypeNamedId) .
        '&documentFunction=default&documentVersion=' . urlencode($docVersion) .
        '&titleIndex=0';

    $headersXml = [
        diadocAuthHeaderFromConfig($config),
        'Content-Type: application/xml'
    ];
    list($code3, $parsedXml, $err3) = diadocCurlRequest('POST', $parseUrl, $headersXml, $xmlRaw, 25, true);
    if ($code3 !== 200 || !$parsedXml) {
        echo json_encode(['ok' => false, 'error' => 'Не удалось распарсить титул (ParseTitleXml)', 'httpCode' => $code3], JSON_UNESCAPED_UNICODE);
        return;
    }

    // 4) Извлекаем строки из parsed XML
    $items = [];
    try {
        libxml_use_internal_errors(true);
        $sx = simplexml_load_string($parsedXml);
        if ($sx) {
            // UniversalTransferDocument/Table/Item or Torg12/Table/Item
            $table = null;
            if (isset($sx->UniversalTransferDocument) && isset($sx->UniversalTransferDocument->Table)) {
                $table = $sx->UniversalTransferDocument->Table;
            } elseif (isset($sx->Torg12) && isset($sx->Torg12->Table)) {
                $table = $sx->Torg12->Table;
            } elseif (isset($sx->Table)) {
                $table = $sx->Table;
            }
            if ($table && isset($table->Item)) {
                foreach ($table->Item as $it) {
                    $name = (string)($it->Product ?? $it->Name ?? $it->Description ?? '');
                    $qty = (float)($it->Quantity ?? 0);
                    $unit = (string)($it->UnitName ?? '');
                    $price = (float)($it->Price ?? 0);
                    $subtotal = (float)($it->Subtotal ?? $it->SubtotalWithVatExcluded ?? 0);
                    $vat = (string)($it->TaxRate ?? '');
                    $barcode = (string)($it->Gtin ?? '');
                    $article = (string)($it->ItemVendorCode ?? '');
                    $items[] = [
                        'name' => $name,
                        'quantity' => $qty,
                        'unitName' => $unit,
                        'price' => $price,
                        'subtotal' => $subtotal,
                        'vatRate' => $vat,
                        'barcode' => $barcode,
                        'article' => $article,
                        'raw' => json_decode(json_encode($it), true)
                    ];
                }
            }
        }
    } catch (Exception $e) {
        // ignore
    }
    
    echo json_encode([
        'ok' => true,
        'items' => $items,
        'xml' => is_string($parsedXml) ? $parsedXml : '',
        'demo' => false
    ], JSON_UNESCAPED_UNICODE);
}

// EDO document lines handler
function handleEDODocumentLines($pdo, $docflowId) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    $withCandidates = isset($_GET['withCandidates']) && $_GET['withCandidates'] === '1';
    
    // Берём строки из parse (если Диадок настроен), иначе демо
    $config = loadDiadocConfigFromSettings($pdo);
    if (!$config) {
        echo json_encode([
            'ok' => true,
            'lines' => [
        [
            'index' => 0,
            'name' => 'Сыр Моцарелла 45%',
            'quantity' => 10,
            'unitName' => 'кг',
            'price' => 820,
            'subtotal' => 8200,
            'vatRate' => '20%',
            'barcode' => '4601234000017',
            'article' => 'MOZ45',
            'matchStatus' => 'pending',
            'match' => null,
            'candidates' => $withCandidates ? [] : null
        ]
            ],
            'demo' => true
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    // внутренний вызов: получить items+xml
    // (дублируем логику лёгким способом — вызываем парсер endpoint напрямую было бы хуже)
    // Здесь делаем минимально: используем те же вызовы, что и в handleEDODocumentParse.
    // Чтобы не копировать код полностью, просто вызываем parse-функцию через буфер вывода нельзя,
    // поэтому повторно идём в Диадок по сокращенной схеме:
    // - GetDocflows -> GetEntityContent -> ParseTitleXml -> items

    // Используем тот же код, что в parse, но возвращаем lines.
    $apiBase = 'https://diadoc-api.kontur.ru';
    $boxId = $config['box_id'];
    $headers = [diadocAuthHeaderFromConfig($config)];
    $docflowUrl = $apiBase . '/GetDocflows?boxId=' . urlencode($boxId) . '&docflowId=' . urlencode($docflowId);
    list($code1, $body1, $err1) = diadocCurlRequest('GET', $docflowUrl, $headers, null, 15, false);
    if ($code1 !== 200 || !$body1) {
        echo json_encode(['ok' => true, 'lines' => [], 'warning' => 'Не удалось обновить строки из Диадока', 'demo' => false], JSON_UNESCAPED_UNICODE);
        return;
    }
    $docflowJson = json_decode($body1, true);
    $documents = $docflowJson['Docflow']['Documents'] ?? [];
    $document = is_array($documents) && count($documents) ? $documents[0] : null;
    if (!$document) {
        echo json_encode(['ok' => true, 'lines' => [], 'demo' => false], JSON_UNESCAPED_UNICODE);
        return;
    }
    $entities = $document['Entities'] ?? [];
    $entity = null;
    foreach ($entities as $e) {
        $t = $e['AttachmentType'] ?? '';
        if ($t === 'XmlTorg12' || $t === 'UniversalTransferDocument') {
            $entity = $e;
            break;
        }
    }
    if (!$entity) {
        echo json_encode(['ok' => true, 'lines' => [], 'demo' => false], JSON_UNESCAPED_UNICODE);
        return;
    }
    $messageId = $document['MessageId'] ?? '';
    $entityId = $entity['EntityId'] ?? '';
    if (!$messageId || !$entityId) {
        echo json_encode(['ok' => true, 'lines' => [], 'demo' => false], JSON_UNESCAPED_UNICODE);
        return;
    }
    $contentUrl = $apiBase . '/GetEntityContent?boxId=' . urlencode($boxId) . '&messageId=' . urlencode($messageId) . '&entityId=' . urlencode($entityId);
    list($code2, $xmlRaw, $err2) = diadocCurlRequest('GET', $contentUrl, $headers, null, 20, true);
    if ($code2 !== 200 || !$xmlRaw) {
        echo json_encode(['ok' => true, 'lines' => [], 'demo' => false], JSON_UNESCAPED_UNICODE);
        return;
    }
    $docTypeNamedId = $entity['AttachmentType'];
    $docVersion = $entity['Version'] ?? 'utd970_05_03_01';
    $parseUrl = $apiBase . '/ParseTitleXml?boxId=' . urlencode($boxId) .
        '&documentTypeNamedId=' . urlencode($docTypeNamedId) .
        '&documentFunction=default&documentVersion=' . urlencode($docVersion) .
        '&titleIndex=0';
    $headersXml = [
        diadocAuthHeaderFromConfig($config),
        'Content-Type: application/xml'
    ];
    list($code3, $parsedXml, $err3) = diadocCurlRequest('POST', $parseUrl, $headersXml, $xmlRaw, 25, true);
    if ($code3 !== 200 || !$parsedXml) {
        echo json_encode(['ok' => true, 'lines' => [], 'demo' => false], JSON_UNESCAPED_UNICODE);
        return;
    }

    $items = [];
    try {
        libxml_use_internal_errors(true);
        $sx = simplexml_load_string($parsedXml);
        if ($sx) {
            $table = null;
            if (isset($sx->UniversalTransferDocument) && isset($sx->UniversalTransferDocument->Table)) {
                $table = $sx->UniversalTransferDocument->Table;
            } elseif (isset($sx->Torg12) && isset($sx->Torg12->Table)) {
                $table = $sx->Torg12->Table;
            } elseif (isset($sx->Table)) {
                $table = $sx->Table;
            }
            if ($table && isset($table->Item)) {
                foreach ($table->Item as $it) {
                    $items[] = $it;
                }
            }
        }
    } catch (Exception $e) {}

    $lines = [];
    $idx = 0;
    foreach ($items as $it) {
        $lines[] = [
            'index' => $idx,
            'name' => (string)($it->Product ?? $it->Name ?? $it->Description ?? ''),
            'quantity' => (float)($it->Quantity ?? 0),
            'unitName' => (string)($it->UnitName ?? ''),
            'price' => (float)($it->Price ?? 0),
            'subtotal' => (float)($it->Subtotal ?? $it->SubtotalWithVatExcluded ?? 0),
            'vatRate' => (string)($it->TaxRate ?? ''),
            'barcode' => (string)($it->Gtin ?? ''),
            'article' => (string)($it->ItemVendorCode ?? ''),
            'matchStatus' => 'pending',
            'match' => null,
            'candidates' => $withCandidates ? [] : null
        ];
        $idx++;
    }

    echo json_encode(['ok' => true, 'lines' => $lines, 'demo' => false], JSON_UNESCAPED_UNICODE);
}

// EDO document auto match handler
function handleEDODocumentAutoMatch($pdo, $docflowId) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    echo json_encode([
        'ok' => true,
        'lines' => [],
        'matched' => 0,
        'message' => 'Автосопоставление выполнено (демо-режим)'
    ]);
}

// EDO document line match handler
function handleEDODocumentLineMatch($pdo, $docflowId, $lineIndex) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $productId = $input['productId'] ?? null;
        
        if (!$productId) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Не указан productId']);
            return;
        }
        
        echo json_encode([
            'ok' => true,
            'line' => [
                'index' => intval($lineIndex),
                'matchStatus' => 'matched',
                'match' => [
                    'productId' => $productId,
                    'source' => $input['source'] ?? 'manual'
                ],
                'candidates' => []
            ]
        ]);
    } elseif ($method === 'DELETE') {
        echo json_encode([
            'ok' => true,
            'line' => [
                'index' => intval($lineIndex),
                'matchStatus' => 'pending',
                'match' => null,
                'candidates' => []
            ]
        ]);
    } else {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    }
}

// EDO document status handler
function handleEDODocumentStatus($pdo, $docflowId) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    echo json_encode([
        'ok' => true,
        'doc' => [
            'docflowId' => $docflowId,
            'status' => 'incoming',
            'type' => 'UniversalTransferDocument'
        ],
        'cached' => false
    ]);
}

// EDO receipts handler
function handleEDOReceipts($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['lines']) || !is_array($input['lines'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Не переданы строки прихода']);
        return;
    }
    
    $receiptId = 'receipt-' . time();
    
    echo json_encode([
        'ok' => true,
        'receiptId' => $receiptId,
        'message' => 'Приход создан (демо-режим)'
    ]);
}

/**
 * Check if promotions are applicable to a given cart
 * POST /api/promotions/check
 * Body: { "cart": [...items], "customer_id": 123 }
 */
function handlePromotionsCheck($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $cart = $input['cart'] ?? [];
    
    $response = [
        'success' => true,
        'appliedPromotions' => [],
        'eligiblePromotions' => []
    ];
    
    // Calculate cart totals by category
    $categoryTotals = [];
    $totalAmount = 0;
    
    foreach ($cart as $item) {
        if (isset($item['isPromoItem']) && $item['isPromoItem']) {
            continue; // Skip promo items from calculation
        }
        
        $category = $item['category'] ?? 'other';
        $itemTotal = ($item['price'] ?? 0) * ($item['qty'] ?? 1);
        
        if (!isset($categoryTotals[$category])) {
            $categoryTotals[$category] = 0;
        }
        $categoryTotals[$category] += $itemTotal;
        $totalAmount += $itemTotal;
    }
    
    // Check ROLL2500 promo
    $rollsAmount = $categoryTotals['rolls'] ?? 0;
    if ($rollsAmount >= 2500) {
        $hasRollGift = false;
        foreach ($cart as $item) {
            if (isset($item['promoId']) && $item['promoId'] === 'ROLL2500') {
                $hasRollGift = true;
                break;
            }
        }
        
        if ($hasRollGift) {
            $response['appliedPromotions'][] = [
                'id' => 'ROLL2500',
                'title' => 'Ролл «Калифорния с крабом» за 1 ₽',
                'status' => 'added',
                'description' => 'Подарок добавлен за покупку роллов от 2500₽'
            ];
        } else {
            $response['eligiblePromotions'][] = [
                'id' => 'ROLL2500',
                'title' => 'Ролл «Калифорния с крабом» за 1 ₽',
                'status' => 'eligible',
                'description' => 'Доступен подарок за роллы от 2500₽',
                'action' => 'add_to_cart'
            ];
        }
    }
    
    // Add metadata about cart
    $response['meta'] = [
        'totalAmount' => $totalAmount,
        'rollsAmount' => $rollsAmount,
        'categoryTotals' => $categoryTotals
    ];
    
    echo json_encode($response);
}

/**
 * Get list of currently eligible promotions for a cart
 * POST /api/promotions/eligible
 * Body: { "cart": [...items] }
 */
function handleEligiblePromotions($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $cart = $input['cart'] ?? [];
    
    $eligible = [];
    
    // Calculate rolls amount
    $rollsAmount = 0;
    foreach ($cart as $item) {
        if (isset($item['isPromoItem']) && $item['isPromoItem']) continue;
        
        $name = strtolower($item['name'] ?? '');
        if (strpos($name, 'ролл') !== false) {
            $rollsAmount += ($item['price'] ?? 0) * ($item['qty'] ?? 1);
        }
    }
    
    // ROLL2500 promo
    if ($rollsAmount >= 2500) {
        // Check if gift already in cart
        $hasGift = false;
        foreach ($cart as $item) {
            if (isset($item['promoId']) && ($item['promoId'] === 'ROLL2500' || $item['promoId'] === 'ROLL6')) {
                $hasGift = true;
                break;
            }
        }
        
        if (!$hasGift) {
            $eligible[] = [
                'id' => 'ROLL2500',
                'type' => 'gift',
                'title' => 'Ролл «Калифорния с крабом» за 1 ₽',
                'requiredCategory' => 'rolls',
                'thresholdAmount' => 2500,
                'currentAmount' => $rollsAmount,
                'giftProduct' => [
                    'name' => 'Калифорния с крабом',
                    'price' => 1,
                    'excludeFromBonuses' => true,
                    'excludeFromDiscounts' => true
                ]
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'eligible' => $eligible,
        'rollsAmount' => $rollsAmount
    ]);
}

/**
 * Handle product import from CSV/YML files
 * POST /api/importProducts
 * FormData: file (CSV or YML), updateExisting (optional checkbox)
 */
function handleImportProducts($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    try {
        // Check if file was uploaded
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'File upload failed',
                'message' => 'Файл не был загружен или произошла ошибка загрузки'
            ]);
            return;
        }
        
        $file = $_FILES['file'];
        // Hard limits from TZ (best-effort; PHP upload limits may still apply)
        $maxBytes = 100 * 1024 * 1024; // 100MB
        if (isset($file['size']) && intval($file['size']) > $maxBytes) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'File too large',
                'message' => 'Файл слишком большой. Максимальный размер: 100MB.'
            ]);
            return;
        }

        $updateExisting = isset($_POST['updateExisting']) && $_POST['updateExisting'] === 'true';
        $importHidden = isset($_POST['importHidden']) && $_POST['importHidden'] === 'true';
        $defaultAccountCode = isset($_POST['account_code']) ? trim((string)$_POST['account_code']) : '';
        $defaultSupplierName = isset($_POST['supplier_name']) ? trim((string)$_POST['supplier_name']) : '';
        $defaultContractNumber = isset($_POST['contract_number']) ? trim((string)$_POST['contract_number']) : '';
        $defaultPaymentTermDays = isset($_POST['payment_term_days']) ? intval($_POST['payment_term_days']) : 0;
        $defaultWarehouseId = isset($_POST['warehouse_id']) ? intval($_POST['warehouse_id']) : 1;
        if ($defaultWarehouseId <= 0) $defaultWarehouseId = 1;

        $csvDelimiterOverride = isset($_POST['csv_delimiter']) ? trim((string)$_POST['csv_delimiter']) : '';
        if ($csvDelimiterOverride === '\\t') {
            $csvDelimiterOverride = "\t";
        }
        if ($csvDelimiterOverride !== '' && !in_array($csvDelimiterOverride, [',', ';', "\t", '|'], true)) {
            $csvDelimiterOverride = '';
        }
        $csvStartRow = isset($_POST['start_row']) ? intval($_POST['start_row']) : 2;
        if ($csvStartRow < 2) $csvStartRow = 2;

        $csvEncoding = isset($_POST['encoding']) ? trim((string)$_POST['encoding']) : '';
        $allowedEnc = ['UTF-8', 'Windows-1251', 'CP866', 'ISO-8859-1'];
        if ($csvEncoding !== '' && !in_array($csvEncoding, $allowedEnc, true)) {
            $csvEncoding = '';
        }

        $fieldMapping = null;
        if (isset($_POST['fieldMapping']) && $_POST['fieldMapping'] !== '') {
            try {
                $fm = json_decode((string)$_POST['fieldMapping'], true);
                if (is_array($fm)) {
                    $fieldMapping = $fm;
                }
            } catch (Exception $e) {
                $fieldMapping = null;
            }
        }

        // Нормализуем и валидируем account_code (разрешённые значения)
        if (!empty($defaultAccountCode)) {
            $defaultAccountCode = normalizeAccountCode($defaultAccountCode);
            if (!in_array($defaultAccountCode, ['10.1', '10.2', '41.1', '43', '43_mod'], true)) {
                $defaultAccountCode = '';
            }
        }
        
        // Validate file type
        $fileName = $file['name'];
        $fileTmpPath = $file['tmp_name'];
        $fileMimeType = $file['type'];
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        
        $allowedExtensions = ['csv', 'yml', 'yaml', 'xml'];
        $allowedMimeTypes = [
            'text/csv',
            'text/plain',
            'application/vnd.ms-excel',
            'application/xml',
            'text/xml'
        ];
        
        if (!in_array($fileExtension, $allowedExtensions)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Invalid file type',
                'message' => 'Разрешенные форматы: CSV, YML/YAML, XML'
            ]);
            return;
        }
        
        // Log import start
        $logPath = __DIR__ . '/../logs/import.log';
        $logDir = dirname($logPath);
        if (!file_exists($logDir)) {
            mkdir($logDir, 0777, true);
        }
        
        $logEntry = date('Y-m-d H:i:s') . " | Импорт начат | Файл: $fileName | Размер: " . filesize($fileTmpPath) . " байт\n";
        file_put_contents($logPath, $logEntry, FILE_APPEND);
        
        $importedCount = 0;
        $updatedCount = 0;
        $errorsCount = 0;
        $errors = [];
        
        // Determine file type and process
        $receiptMeta = null;
        if ($fileExtension === 'csv') {
            $result = processCSVFile($pdo, $fileTmpPath, $updateExisting, $importHidden, $logPath, $defaultAccountCode, $defaultSupplierName, $defaultContractNumber, $defaultPaymentTermDays, $defaultWarehouseId, $fieldMapping, $csvDelimiterOverride, $csvStartRow, $csvEncoding);
            $importedCount = $result['created'];
            $updatedCount = $result['updated'];
            $errorsCount = $result['errors'];
            $errors = $result['errorMessages'];
            if (isset($result['receipt']) && is_array($result['receipt'])) {
                $receiptMeta = $result['receipt'];
            }
        } else if (in_array($fileExtension, ['yml', 'yaml', 'xml'])) {
            // LPmotor YML import (pizza grouping + modifiers + category tree)
            // Use new importer only for LPmotor-like feeds to avoid breaking other XML imports.
            $head = '';
            try {
                $head = file_get_contents($fileTmpPath, false, null, 0, 65536);
            } catch (Exception $e) {
                $head = '';
            }
            $headLower = mb_strtolower((string)$head, 'UTF-8');
            $isLpMotor = (mb_strpos($headLower, '<yml_catalog', 0, 'UTF-8') !== false) && (
                mb_strpos($headLower, '<platform>mottor</platform>', 0, 'UTF-8') !== false ||
                mb_strpos($headLower, '<categories>', 0, 'UTF-8') !== false
            );

            if ($isLpMotor) {
                $modifierCategoryExternalId = isset($_POST['modifierCategoryExternalId']) ? trim((string)$_POST['modifierCategoryExternalId']) : '';
                $pizzaCategoryExternalId = isset($_POST['pizzaCategoryExternalId']) ? trim((string)$_POST['pizzaCategoryExternalId']) : '';
                $groupingMode = isset($_POST['groupingMode']) ? trim((string)$_POST['groupingMode']) : '';
                if ($groupingMode === '') $groupingMode = 'auto';

                $stats = applyYmlLpMotorImport($pdo, $fileTmpPath, [
                    'updateExisting' => $updateExisting,
                    'modifierCategoryExternalId' => $modifierCategoryExternalId,
                    'pizzaCategoryExternalId' => $pizzaCategoryExternalId,
                    'groupingMode' => $groupingMode
                ]);

                $importedCount = intval(($stats['parents_created'] ?? 0)) + intval(($stats['variants_created'] ?? 0)) + intval(($stats['modifiers_created'] ?? 0));
                $updatedCount = intval(($stats['parents_updated'] ?? 0)) + intval(($stats['variants_updated'] ?? 0)) + intval(($stats['modifiers_updated'] ?? 0));
                $errorsCount = 0;
                $errors = [];
                $receiptMeta = null;
            } else {
                // Legacy parser for generic XML/YML feeds (keeps inventory receipt support, field mapping, etc.)
                $result = processYMLFile($pdo, $fileTmpPath, $updateExisting, $importHidden, $logPath, $defaultAccountCode, $defaultSupplierName, $defaultContractNumber, $defaultPaymentTermDays, $defaultWarehouseId, $fieldMapping);
                $importedCount = $result['created'];
                $updatedCount = $result['updated'];
                $errorsCount = $result['errors'];
                $errors = $result['errorMessages'];
                if (isset($result['receipt']) && is_array($result['receipt'])) {
                    $receiptMeta = $result['receipt'];
                }
            }
        } else {
            throw new Exception('Unsupported file format');
        }
        
        // Log import completion
        $logEntry = date('Y-m-d H:i:s') . " | Импорт завершен | Создано: $importedCount | Обновлено: $updatedCount | Ошибок: $errorsCount\n";
        if (!empty($errors)) {
            $logEntry .= "Ошибки:\n" . implode("\n", array_slice($errors, 0, 10)) . "\n";
        }
        file_put_contents($logPath, $logEntry, FILE_APPEND);
        
        echo json_encode([
            'success' => true,
            'message' => "Импорт завершен. Создано: $importedCount, Обновлено: $updatedCount, Ошибок: $errorsCount",
            'created' => $importedCount,
            'updated' => $updatedCount,
            'errors' => $errorsCount,
            'errorMessages' => array_slice($errors, 0, 10), // Return first 10 errors
            'receipt' => $receiptMeta
        ]);
        
    } catch (Exception $e) {
        $logEntry = date('Y-m-d H:i:s') . " | ОШИБКА ИМПОРТА: " . $e->getMessage() . "\n";
        file_put_contents($logPath ?? __DIR__ . '/../logs/import.log', $logEntry, FILE_APPEND);
        
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Import failed',
            'message' => $e->getMessage()
        ]);
    }
}

function handleImportYml($pdo) {
    // Alias for TZ endpoint. Full TZ logic will be implemented separately.
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'File upload failed']);
        return;
    }

    $updateExisting = !isset($_POST['updateExisting']) || ($_POST['updateExisting'] === 'true' || $_POST['updateExisting'] === '1');
    $modifierCategoryExternalId = isset($_POST['modifierCategoryExternalId']) ? trim((string)$_POST['modifierCategoryExternalId']) : '';
    $pizzaCategoryExternalId = isset($_POST['pizzaCategoryExternalId']) ? trim((string)$_POST['pizzaCategoryExternalId']) : '';
    $groupingMode = isset($_POST['groupingMode']) ? trim((string)$_POST['groupingMode']) : '';
    if ($groupingMode === '') $groupingMode = 'auto';

    // Log import start (best-effort)
    $logPath = __DIR__ . '/../logs/import.log';
    $logDir = dirname($logPath);
    if (!file_exists($logDir)) {
        @mkdir($logDir, 0777, true);
    }

    $tmp = $_FILES['file']['tmp_name'];
    $head = '';
    try {
        $head = file_get_contents($tmp, false, null, 0, 65536);
    } catch (Exception $e) {
        $head = '';
    }
    $headLower = mb_strtolower((string)$head, 'UTF-8');
    $isLpMotor = (mb_strpos($headLower, '<yml_catalog', 0, 'UTF-8') !== false) && (
        mb_strpos($headLower, '<platform>mottor</platform>', 0, 'UTF-8') !== false ||
        mb_strpos($headLower, '<categories>', 0, 'UTF-8') !== false
    );

    try {
        if ($isLpMotor) {
            $stats = applyYmlLpMotorImport($pdo, $tmp, [
                'updateExisting' => $updateExisting,
                'modifierCategoryExternalId' => $modifierCategoryExternalId,
                'pizzaCategoryExternalId' => $pizzaCategoryExternalId,
                'groupingMode' => $groupingMode
            ]);
            echo json_encode(['success' => true, 'ok' => true, 'data' => $stats, 'format' => 'lpmotor']);
            return;
        }

        $result = processYMLFile($pdo, $tmp, $updateExisting, false, $logPath, '', '', '', 0, 1, null);
        $genericStats = [
            'created' => intval($result['created'] ?? 0),
            'updated' => intval($result['updated'] ?? 0),
            'errors' => intval($result['errors'] ?? 0)
        ];
        echo json_encode(['success' => true, 'ok' => true, 'data' => $genericStats, 'format' => 'generic']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleImportYmlPreview($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'File upload failed']);
        return;
    }

    ensureImportJobsTable($pdo);
    $uploadDir = __DIR__ . '/../uploads/import/';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0777, true);
    }

    $name = (string)($_FILES['file']['name'] ?? 'import.yml');
    $safeName = preg_replace('/[^0-9a-zA-Z_\-\.]+/', '_', $name);
    $path = $uploadDir . 'yml_' . time() . '_' . $safeName;
    @move_uploaded_file($_FILES['file']['tmp_name'], $path);

    $head = '';
    try {
        $head = file_get_contents($path, false, null, 0, 65536);
    } catch (Exception $e) {
        $head = '';
    }
    $headLower = mb_strtolower((string)$head, 'UTF-8');
    $isLpMotor = (mb_strpos($headLower, '<yml_catalog', 0, 'UTF-8') !== false) && (
        mb_strpos($headLower, '<platform>mottor</platform>', 0, 'UTF-8') !== false ||
        mb_strpos($headLower, '<categories>', 0, 'UTF-8') !== false
    );

    try {
        $summary = [
            'categories' => 0,
            'offers' => 0,
            'groups' => 0,
            'modifier_offers' => 0,
            'format' => $isLpMotor ? 'lpmotor' : 'generic'
        ];

        if ($isLpMotor) {
            $parsed = parseYmlLpMotor($path);
            $summary['categories'] = isset($parsed['categories']) && is_array($parsed['categories']) ? count($parsed['categories']) : 0;
            $summary['offers'] = isset($parsed['offers']) && is_array($parsed['offers']) ? count($parsed['offers']) : 0;
            $summary['groups'] = isset($parsed['groups']) && is_array($parsed['groups']) ? count($parsed['groups']) : 0;
            $summary['modifier_offers'] = isset($parsed['modifierOffers']) && is_array($parsed['modifierOffers']) ? count($parsed['modifierOffers']) : 0;
        }

        $meta = json_encode(['file_path' => $path, 'filename' => $name, 'summary' => $summary, 'is_lpmotor' => $isLpMotor ? 1 : 0], JSON_UNESCAPED_UNICODE);

        $stmt = $pdo->prepare("INSERT INTO import_jobs (type, status, created_at, updated_at, total_rows, processed_rows, error, meta) VALUES ('yml', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, 0, NULL, ?)");
        $stmt->execute([intval($summary['offers']), $meta]);
        $jobId = intval($pdo->lastInsertId());
        echo json_encode(['success' => true, 'ok' => true, 'jobId' => $jobId, 'summary' => $summary]);
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleImportYmlConfirm($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }

    ensureImportJobsTable($pdo);
    $input = json_decode(file_get_contents('php://input'), true);
    $jobId = intval($input['jobId'] ?? 0);
    if ($jobId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'jobId is required']);
        return;
    }
    $updateExisting = isset($input['updateExisting']) ? (bool)$input['updateExisting'] : true;
    $modifierCategoryExternalId = isset($input['modifierCategoryExternalId']) ? trim((string)$input['modifierCategoryExternalId']) : '';
    $pizzaCategoryExternalId = isset($input['pizzaCategoryExternalId']) ? trim((string)$input['pizzaCategoryExternalId']) : '';
    $groupingMode = isset($input['groupingMode']) ? trim((string)$input['groupingMode']) : '';
    if ($groupingMode === '') $groupingMode = 'auto';

    $stmt = $pdo->prepare("SELECT id, status, meta FROM import_jobs WHERE id = ? AND type = 'yml' LIMIT 1");
    $stmt->execute([$jobId]);
    $job = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$job) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Job not found']);
        return;
    }

    $meta = json_decode($job['meta'] ?? '{}', true);
    $filePath = $meta['file_path'] ?? null;
    if (!$filePath || !file_exists($filePath)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Stored file not found']);
        return;
    }

    try {
        $pdo->prepare("UPDATE import_jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$jobId]);
    } catch (Exception $e) {
        // ignore
    }

    // Log import start (best-effort)
    $logPath = __DIR__ . '/../logs/import.log';
    $logDir = dirname($logPath);
    if (!file_exists($logDir)) {
        @mkdir($logDir, 0777, true);
    }

    $isLpMotor = !empty($meta['is_lpmotor']);

    try {
        if ($isLpMotor) {
            $stats = applyYmlLpMotorImport($pdo, $filePath, [
                'updateExisting' => $updateExisting,
                'modifierCategoryExternalId' => $modifierCategoryExternalId,
                'pizzaCategoryExternalId' => $pizzaCategoryExternalId,
                'groupingMode' => $groupingMode
            ]);
        } else {
            $result = processYMLFile($pdo, $filePath, $updateExisting, false, $logPath, '', '', '', 0, 1, null);
            $stats = [
                'created' => intval($result['created'] ?? 0),
                'updated' => intval($result['updated'] ?? 0),
                'errors' => intval($result['errors'] ?? 0)
            ];
        }

        $meta['result'] = $stats;
        $pdo->prepare("UPDATE import_jobs SET status = 'completed', processed_rows = total_rows, error = NULL, meta = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([json_encode($meta, JSON_UNESCAPED_UNICODE), $jobId]);
        echo json_encode(['success' => true, 'ok' => true, 'jobId' => $jobId, 'stats' => $stats]);
    } catch (Exception $e) {
        try {
            $pdo->prepare("UPDATE import_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                ->execute([$e->getMessage(), $jobId]);
        } catch (Exception $e2) {
            // ignore
        }
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleImportYmlHistory($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }

    ensureImportJobsTable($pdo);
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
    if ($limit <= 0) $limit = 50;
    if ($limit > 200) $limit = 200;

    try {
        $stmt = $pdo->prepare("SELECT id, type, status, created_at, updated_at, total_rows, processed_rows, error, meta FROM import_jobs WHERE type = 'yml' ORDER BY id DESC LIMIT ?");
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$r) {
            $r['meta'] = json_decode($r['meta'] ?? '{}', true);
        }
        unset($r);
        echo json_encode(['success' => true, 'ok' => true, 'data' => $rows]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function ensureImportJobsTable($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS import_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, total_rows INTEGER, processed_rows INTEGER, error TEXT, meta TEXT)");
}

function ymlReadOfferParamValue($offer, $name) {
    try {
        if (!$offer || !$name) return '';
        if (!isset($offer->param)) return '';
        $target = mb_strtolower(trim((string)$name), 'UTF-8');
        foreach ($offer->param as $p) {
            $n = isset($p['name']) ? mb_strtolower(trim((string)$p['name']), 'UTF-8') : '';
            if ($n === '' || $n !== $target) continue;
            return trim((string)$p);
        }
        return '';
    } catch (Exception $e) {
        return '';
    }
}

function ymlFirstNonEmpty(...$values) {
    foreach ($values as $v) {
        $s = trim((string)($v ?? ''));
        if ($s !== '') return $s;
    }
    return '';
}

function detectYmlCategoryIdByNames($categoryMap, $needles = []) {
    try {
        if (!is_array($categoryMap) || empty($categoryMap)) return '';
        if (!is_array($needles) || empty($needles)) return '';

        $needleNorm = [];
        foreach ($needles as $n) {
            $nn = normalizeCategoryNameForMatch($n);
            if ($nn !== '') $needleNorm[] = $nn;
        }
        if (empty($needleNorm)) return '';

        $bestExt = '';
        $bestScore = null;
        foreach ($categoryMap as $ext => $row) {
            $name = '';
            if (is_array($row)) {
                $name = trim((string)($row['name'] ?? ''));
            } else {
                $name = trim((string)$row);
            }
            if ($name === '') continue;
            $norm = normalizeCategoryNameForMatch($name);
            if ($norm === '') continue;

            foreach ($needleNorm as $nn) {
                // score: exact match is best, then contains match
                if ($norm === $nn) {
                    return (string)$ext;
                }
                if (mb_strpos($norm, $nn, 0, 'UTF-8') !== false || mb_strpos($nn, $norm, 0, 'UTF-8') !== false) {
                    $score = abs(mb_strlen($norm, 'UTF-8') - mb_strlen($nn, 'UTF-8'));
                    if ($bestScore === null || $score < $bestScore) {
                        $bestScore = $score;
                        $bestExt = (string)$ext;
                    }
                }
            }
        }
        return $bestExt;
    } catch (Exception $e) {
        return '';
    }
}

function ymlOfferGroupId($offer) {
    try {
        if (!$offer) return '';

        $gid = '';
        if (isset($offer['group_id'])) $gid = trim((string)$offer['group_id']);
        if ($gid === '' && isset($offer['groupId'])) $gid = trim((string)$offer['groupId']);
        if ($gid === '' && isset($offer->group_id)) $gid = trim((string)$offer->group_id);
        if ($gid === '' && isset($offer->groupId)) $gid = trim((string)$offer->groupId);

        if ($gid === '') $gid = ymlReadOfferParamValue($offer, 'group_id');
        if ($gid === '') $gid = ymlReadOfferParamValue($offer, 'groupId');
        if ($gid === '') $gid = ymlReadOfferParamValue($offer, 'group');

        if ($gid === '') {
            $sku = ymlOfferSku($offer);
            $sku = trim((string)$sku);
            if ($sku !== '' && preg_match('/^п\\\\(\d+)\\\\(\d+)$/u', $sku, $m)) {
                $gid = 'п\\' . $m[1];
            }
        }

        return trim((string)$gid);
    } catch (Exception $e) {
        return '';
    }
}

function ymlOfferId($offer) {
    try {
        if (!$offer) return '';
        if (isset($offer['id'])) {
            $id = trim((string)$offer['id']);
            if ($id !== '') return $id;
        }
        if (isset($offer->id)) {
            $id = trim((string)$offer->id);
            if ($id !== '') return $id;
        }
        return '';
    } catch (Exception $e) {
        return '';
    }
}

function ymlOfferSku($offer) {
    try {
        if (!$offer) return '';
        $vendor = isset($offer->vendorCode) ? trim((string)$offer->vendorCode) : '';
        $barcode = isset($offer->barcode) ? trim((string)$offer->barcode) : '';
        $id = ymlOfferId($offer);
        return ymlFirstNonEmpty($vendor, $barcode, $id);
    } catch (Exception $e) {
        return '';
    }
}

function extractBaseNameFromSize($name) {
    $n = trim((string)$name);
    if ($n === '') return '';
    $n = preg_replace('/\s*[\(\[]?\s*(25|30|32|33|35|40|42)\s*(?:см|cm)\.?\s*[\)\]]?\s*$/iu', '', $n);
    $n = preg_replace('/\s*(25|30|32|33|35|40|42)\s*(?:см|cm)\.?\s*$/iu', '', $n);
    return trim((string)$n);
}

function parseSizeLabelFromOffer($offer, $fallbackName = '') {
    $size = ymlReadOfferParamValue($offer, 'Размер');
    if ($size === '') {
        $size = ymlReadOfferParamValue($offer, 'size');
    }
    if ($size === '' && isset($offer->param)) {
        try {
            foreach ($offer->param as $p) {
                $n = isset($p['name']) ? mb_strtolower(trim((string)$p['name']), 'UTF-8') : '';
                if ($n === '') continue;
                // Частый кейс YML для пиццы: размер зашит в ИМЯ параметра, например <param name="25">...</param>
                // В этом случае имя параметра — число диаметра.
                if (preg_match('/^\d{2}$/u', $n)) {
                    $d = intval($n);
                    if ($d >= 20 && $d <= 60) {
                        $size = $d . ' см';
                        break;
                    }
                }
                if (mb_strpos($n, 'размер') === false && mb_strpos($n, 'size') === false && mb_strpos($n, 'диаметр') === false) continue;
                $v = trim((string)$p);
                if ($v === '') continue;
                $size = $v;
                break;
            }
        } catch (Exception $e) {
            // ignore
        }
    }
    if ($size === '' && $fallbackName !== '') {
        if (preg_match('/(25|30|32|33|35|40|42)\s*(?:см|cm)/iu', (string)$fallbackName, $m)) {
            $size = $m[1] . ' см';
        }
    }

    if ($size === '') {
        $sku = ymlOfferSku($offer);
        $sku = trim((string)$sku);
        if ($sku !== '' && preg_match('/^п\\\\(\d+)\\\\(\d+)$/u', $sku, $m)) {
            $idx = intval($m[2]);
            $map = [1 => 25, 2 => 32, 3 => 42];
            if (isset($map[$idx])) {
                $size = $map[$idx] . ' см';
            }
        }
    }
    return trim((string)$size);
}

function parseDiameterFromSizeLabel($sizeLabel) {
    $s = trim((string)$sizeLabel);
    if ($s === '') return null;
    if (preg_match('/(\d{2})/', $s, $m)) {
        $d = intval($m[1]);
        return $d > 0 ? $d : null;
    }
    return null;
}

function calculateRecipeCoefficientFromDiameter($diameter) {
    $d = intval($diameter);
    if ($d <= 0) return 1.000;
    $base = 25.0;
    $coef = pow(($d / $base), 2);
    if ($coef <= 0) $coef = 1.000;
    return round($coef, 3);
}

function normalizeCategoryNameForMatch($name) {
    $s = trim((string)$name);
    if ($s === '') return '';
    $s = mb_strtolower($s, 'UTF-8');
    $s = str_replace(['ё', 'Ё'], ['е', 'Е'], $s);
    $s = preg_replace('/[^a-z0-9а-я]+/u', '', $s);
    // collapse repeated chars to tolerate simple typos like "пииццы" -> "пицы"
    $s = preg_replace('/(.)\1+/u', '$1', $s);
    return trim((string)$s);
}

function utf8_levenshtein_distance($s1, $s2) {
    $a = preg_split('//u', (string)$s1, -1, PREG_SPLIT_NO_EMPTY);
    $b = preg_split('//u', (string)$s2, -1, PREG_SPLIT_NO_EMPTY);
    $n = is_array($a) ? count($a) : 0;
    $m = is_array($b) ? count($b) : 0;
    if ($n === 0) return $m;
    if ($m === 0) return $n;

    $prev = range(0, $m);
    $curr = array_fill(0, $m + 1, 0);
    for ($i = 1; $i <= $n; $i++) {
        $curr[0] = $i;
        for ($j = 1; $j <= $m; $j++) {
            $cost = ($a[$i - 1] === $b[$j - 1]) ? 0 : 1;
            $curr[$j] = min(
                $prev[$j] + 1,
                $curr[$j - 1] + 1,
                $prev[$j - 1] + $cost
            );
        }
        $prev = $curr;
    }
    return intval($prev[$m]);
}

function findFuzzyCategoryCandidate($pdo, $name, $parentId = null) {
    try {
        $nm = trim((string)$name);
        if ($nm === '') return null;
        $target = normalizeCategoryNameForMatch($nm);
        if ($target === '') return null;

        $pid = $parentId !== null ? intval($parentId) : null;
        $stmt = $pdo->prepare("SELECT id, name, slug FROM categories WHERE parent_id IS ? AND (external_id IS NULL OR external_id = '')");
        $stmt->execute([$pid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (!is_array($rows) || empty($rows)) return null;

        $best = null;
        $bestDist = null;
        $maxDist = (mb_strlen($target, 'UTF-8') <= 4) ? 1 : 2;
        foreach ($rows as $r) {
            $candName = trim((string)($r['name'] ?? ''));
            if ($candName === '') continue;
            $cand = normalizeCategoryNameForMatch($candName);
            if ($cand === '') continue;
            $dist = utf8_levenshtein_distance($target, $cand);
            if ($dist <= $maxDist && ($bestDist === null || $dist < $bestDist)) {
                $bestDist = $dist;
                $best = $r;
                if ($dist === 0) break;
            }
        }
        return $best;
    } catch (Exception $e) {
        return null;
    }
}

function upsertCategoryByExternalId($pdo, $externalId, $name, $parentId = null, $position = 0) {
    $ext = trim((string)$externalId);
    if ($ext === '') return null;
    $nm = trim((string)$name);
    if ($nm === '') $nm = $ext;
    $pid = $parentId !== null ? intval($parentId) : null;

    $slug = generateSlug($nm);
    if ($slug === '') {
        $slug = generateSlug('cat-' . $ext);
    }

    $slugCandidates = [];
    if ($slug !== '') $slugCandidates[] = $slug;
    if ($slug === 'пицца' && !in_array('pizza', $slugCandidates, true)) $slugCandidates[] = 'pizza';

    $stmt = $pdo->prepare("SELECT id FROM categories WHERE external_id = ? LIMIT 1");
    $stmt->execute([$ext]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && isset($row['id'])) {
        $cid = intval($row['id']);

        try {
            $cCols = $pdo->query("PRAGMA table_info(categories)")->fetchAll(PDO::FETCH_ASSOC);
            $cNames = array_column($cCols, 'name');
            $hasExternal = in_array('external_id', $cNames, true);
            $hasSlug = in_array('slug', $cNames, true);
            $hasShowOnSite = in_array('show_on_site', $cNames, true);
            $hasShowInNav = in_array('show_in_nav', $cNames, true);

            if ($hasExternal) {
                $cand = null;
                if ($hasSlug && !empty($slugCandidates)) {
                    foreach ($slugCandidates as $sc) {
                        if ($sc === '') continue;
                        $s = $pdo->prepare("SELECT id FROM categories WHERE slug = ? AND (external_id IS NULL OR external_id = '') LIMIT 1");
                        $s->execute([$sc]);
                        $cand = $s->fetch(PDO::FETCH_ASSOC);
                        if ($cand && isset($cand['id'])) break;
                    }
                }
                if (!$cand) {
                    $s = $pdo->prepare("SELECT id FROM categories WHERE name = ? AND (external_id IS NULL OR external_id = '') LIMIT 1");
                    $s->execute([$nm]);
                    $cand = $s->fetch(PDO::FETCH_ASSOC);
                }
                if (!$cand) {
                    $cand = findFuzzyCategoryCandidate($pdo, $nm, $pid);
                }
                if ($cand && isset($cand['id'])) {
                    $newCid = intval($cand['id']);
                    if ($newCid > 0 && $newCid !== $cid) {
                        $pdo->prepare("UPDATE categories SET external_id = ?, name = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                            ->execute([$ext, $nm, $pid, $newCid]);

                        // move product links
                        try {
                            $pdo->prepare("UPDATE product_category SET category_id = ? WHERE category_id = ?")
                                ->execute([$newCid, $cid]);
                        } catch (Exception $e) {
                            // ignore
                        }

                        // move children
                        try {
                            $pdo->prepare("UPDATE categories SET parent_id = ? WHERE parent_id = ?")
                                ->execute([$newCid, $cid]);
                        } catch (Exception $e) {
                            // ignore
                        }

                        // move menu_sections if exists
                        try {
                            $t = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='menu_sections'");
                            $has = $t ? $t->fetchColumn() : false;
                            if ($has) {
                                $pdo->prepare("UPDATE menu_sections SET category_id = ? WHERE category_id = ?")
                                    ->execute([$newCid, $cid]);
                            }
                        } catch (Exception $e) {
                            // ignore
                        }

                        // hide the duplicate and clear its external_id so next lookup uses the canonical one
                        try {
                            $fields = ["external_id = ''"];
                            if ($hasShowOnSite) $fields[] = "show_on_site = 0";
                            if ($hasShowInNav) $fields[] = "show_in_nav = 0";
                            $pdo->prepare("UPDATE categories SET " . implode(', ', $fields) . ", updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                                ->execute([$cid]);
                        } catch (Exception $e) {
                            // ignore
                        }

                        return $newCid;
                    }
                }
            }
        } catch (Exception $e) {
            // ignore
        }

        $upd = $pdo->prepare("UPDATE categories SET name = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $upd->execute([$nm, $pid, $cid]);
        return $cid;
    }

    try {
        $cCols = $pdo->query("PRAGMA table_info(categories)")->fetchAll(PDO::FETCH_ASSOC);
        $cNames = array_column($cCols, 'name');
        $hasExternal = in_array('external_id', $cNames, true);
        $hasSlug = in_array('slug', $cNames, true);

        if ($hasExternal) {
            $cand = null;
            if ($hasSlug && !empty($slugCandidates)) {
                foreach ($slugCandidates as $sc) {
                    if ($sc === '') continue;
                    $s = $pdo->prepare("SELECT id FROM categories WHERE slug = ? AND (external_id IS NULL OR external_id = '') LIMIT 1");
                    $s->execute([$sc]);
                    $cand = $s->fetch(PDO::FETCH_ASSOC);
                    if ($cand && isset($cand['id'])) break;
                }
            }
            if (!$cand) {
                $s = $pdo->prepare("SELECT id FROM categories WHERE name = ? AND (external_id IS NULL OR external_id = '') LIMIT 1");
                $s->execute([$nm]);
                $cand = $s->fetch(PDO::FETCH_ASSOC);
            }
            if (!$cand) {
                $cand = findFuzzyCategoryCandidate($pdo, $nm, $pid);
            }
            if ($cand && isset($cand['id'])) {
                $newCid = intval($cand['id']);
                if ($newCid > 0) {
                    $pdo->prepare("UPDATE categories SET external_id = ?, name = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                        ->execute([$ext, $nm, $pid, $newCid]);
                    return $newCid;
                }
            }
        }
    } catch (Exception $e) {
        // ignore
    }

    $ins = $pdo->prepare("INSERT INTO categories (name, slug, parent_id, type, show_on_site, show_in_nav, position, external_id, created_at, updated_at) VALUES (?, ?, ?, 'menu', 1, 1, ?, ?, datetime('now'), datetime('now'))");
    $ins->execute([$nm, $slug, $pid, intval($position), $ext]);
    return intval($pdo->lastInsertId());
}

function linkProductToCategoryId($pdo, $productId, $categoryId) {
    $pid = intval($productId);
    $cid = intval($categoryId);
    if ($pid <= 0 || $cid <= 0) return;
    $stmt = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
    $stmt->execute([$pid, $cid]);
}

function parseYmlLpMotor($filePath) {
    libxml_use_internal_errors(true);
    $xml = simplexml_load_file($filePath);
    if ($xml === false) {
        $xmlErrors = libxml_get_errors();
        $msg = 'YML parse error';
        if (is_array($xmlErrors) && !empty($xmlErrors)) {
            $msg = trim((string)($xmlErrors[0]->message ?? $msg));
        }
        throw new Exception($msg);
    }

    $categories = $xml->xpath('//category');
    if (!is_array($categories)) $categories = [];
    $offers = $xml->xpath('//offer');
    if (!is_array($offers)) $offers = [];

    $groups = [];
    $modifierOffers = [];
    foreach ($offers as $offer) {
        $catId = trim((string)($offer->categoryId ?? ''));
        if ($catId === '40337982') {
            $modifierOffers[] = $offer;
            continue;
        }
        $gid = trim((string)($offer['group_id'] ?? ''));
        if ($gid === '') $gid = trim((string)($offer['groupId'] ?? ''));
        if ($gid === '') $gid = trim((string)($offer['id'] ?? ''));
        if ($gid === '') $gid = md5((string)($offer->name ?? '') . '|' . (string)($offer->vendorCode ?? ''));
        if (!isset($groups[$gid])) $groups[$gid] = [];
        $groups[$gid][] = $offer;
    }

    return [
        'xml' => $xml,
        'categories' => $categories,
        'offers' => $offers,
        'groups' => $groups,
        'modifierOffers' => $modifierOffers
    ];
}

function applyYmlLpMotorImport($pdo, $filePath, $options = []) {
    $updateExisting = isset($options['updateExisting']) ? (bool)$options['updateExisting'] : true;
    $groupingMode = isset($options['groupingMode']) ? trim((string)$options['groupingMode']) : 'auto';
    if (!in_array($groupingMode, ['auto', 'always', 'never'], true)) $groupingMode = 'auto';
    $modifierCategoryExternalId = isset($options['modifierCategoryExternalId']) ? trim((string)$options['modifierCategoryExternalId']) : '';
    $pizzaCategoryExternalId = isset($options['pizzaCategoryExternalId']) ? trim((string)$options['pizzaCategoryExternalId']) : '';
    $parsed = parseYmlLpMotor($filePath);

    $stats = [
        'categories_created' => 0,
        'categories_updated' => 0,
        'parents_created' => 0,
        'parents_updated' => 0,
        'variants_created' => 0,
        'variants_updated' => 0,
        'modifiers_created' => 0,
        'modifiers_updated' => 0,
        'links_created' => 0
    ];

    $pdo->beginTransaction();
    try {
        $categoryMap = [];
        foreach ($parsed['categories'] as $cat) {
            $ext = trim((string)($cat['id'] ?? ''));
            if ($ext === '') continue;
            $nm = trim((string)$cat);
            $categoryMap[$ext] = [
                'external_id' => $ext,
                'name' => $nm,
                'parent_external_id' => trim((string)($cat['parentId'] ?? ''))
            ];
        }

        if ($modifierCategoryExternalId === '') {
            $modifierCategoryExternalId = detectYmlCategoryIdByNames($categoryMap, ['допы', 'доп', 'добавки', 'топпинги', 'модификатор', 'модификаторы']);
        }
        if ($modifierCategoryExternalId === '') $modifierCategoryExternalId = '40337982';

        if ($pizzaCategoryExternalId === '') {
            $pizzaCategoryExternalId = detectYmlCategoryIdByNames($categoryMap, ['пицца', 'pizza']);
        }
        if ($pizzaCategoryExternalId === '') $pizzaCategoryExternalId = '40260715';

        $resolvedIds = [];
        foreach ($categoryMap as $ext => $row) {
            $parentExt = $row['parent_external_id'];
            $parentId = null;
            if ($parentExt !== '' && isset($resolvedIds[$parentExt])) {
                $parentId = $resolvedIds[$parentExt];
            }
            $existingId = null;
            $stmt = $pdo->prepare("SELECT id FROM categories WHERE external_id = ? LIMIT 1");
            $stmt->execute([$ext]);
            $r = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($r && isset($r['id'])) $existingId = intval($r['id']);
            $cid = upsertCategoryByExternalId($pdo, $ext, $row['name'], $parentId, 0);
            if ($cid) {
                $resolvedIds[$ext] = $cid;
                if ($existingId) $stats['categories_updated']++;
                else $stats['categories_created']++;
            }
        }

        foreach ($categoryMap as $ext => $row) {
            $parentExt = $row['parent_external_id'];
            if ($parentExt === '') continue;
            if (!isset($resolvedIds[$ext]) || !isset($resolvedIds[$parentExt])) continue;
            $pdo->prepare("UPDATE categories SET parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                ->execute([intval($resolvedIds[$parentExt]), intval($resolvedIds[$ext])]);
        }

        $modifierOffers = [];
        $groups = [];
        $singleOffers = [];
        foreach ($parsed['offers'] as $offer) {
            $catId = trim((string)($offer->categoryId ?? ''));
            if ($catId !== '' && $catId === $modifierCategoryExternalId) {
                $modifierOffers[] = $offer;
                continue;
            }

            $gid = ymlOfferGroupId($offer);
            if ($groupingMode === 'never') $gid = '';

            if ($gid === '' && $groupingMode === 'auto') {
                $name = trim((string)($offer->name ?? ''));
                $base = extractBaseNameFromSize($name);
                $sizeLabel = parseSizeLabelFromOffer($offer, $name);
                $hasSize = ($sizeLabel !== '') || ($base !== '' && $base !== $name);
                if ($hasSize && $base !== '') {
                    $key = 'name|' . $catId . '|' . $base;
                    $gid = (string)sprintf('%u', crc32($key));
                }
            }

            if ($gid === '') {
                if ($groupingMode === 'always') {
                    $gid = ymlOfferId($offer);
                    if ($gid === '') $gid = md5((string)($offer->name ?? '') . '|' . (string)($offer->vendorCode ?? ''));
                    if (!isset($groups[$gid])) $groups[$gid] = [];
                    $groups[$gid][] = $offer;
                } else {
                    $singleOffers[] = $offer;
                }
            } else {
                if (!isset($groups[$gid])) $groups[$gid] = [];
                $groups[$gid][] = $offer;
            }
        }

        $modCategoryId = isset($resolvedIds[$modifierCategoryExternalId]) ? intval($resolvedIds[$modifierCategoryExternalId]) : null;

        $pizzaCategoryId = isset($resolvedIds[$pizzaCategoryExternalId]) ? intval($resolvedIds[$pizzaCategoryExternalId]) : null;
        if (!$pizzaCategoryId) {
            try {
                $cCols = $pdo->query("PRAGMA table_info(categories)")->fetchAll(PDO::FETCH_ASSOC);
                $cNames = array_column($cCols, 'name');
                $hasSlug = in_array('slug', $cNames, true);

                if ($hasSlug) {
                    $stmt = $pdo->prepare("SELECT id FROM categories WHERE slug = ? OR slug LIKE ? ORDER BY CASE WHEN slug = ? THEN 0 ELSE 1 END, id ASC LIMIT 1");
                    $stmt->execute(['pizza', '%pizza%', 'pizza']);
                    $r = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($r && isset($r['id'])) {
                        $pizzaCategoryId = intval($r['id']);
                    }
                }

                if (!$pizzaCategoryId) {
                    $stmt = $pdo->prepare("SELECT id FROM categories WHERE name LIKE ? OR name LIKE ? OR name LIKE ? OR name LIKE ? ORDER BY COALESCE(parent_id, 0) ASC, id ASC LIMIT 1");
                    $stmt->execute(['%Пиц%', '%пиц%', '%Pizza%', '%pizza%']);
                    $r = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($r && isset($r['id'])) $pizzaCategoryId = intval($r['id']);
                }
            } catch (Exception $e) {
                $pizzaCategoryId = null;
            }
        }

        $downloadCategoryExternalId = '';
        try {
            $downloadCategoryExternalId = detectYmlCategoryIdByNames($categoryMap, ['скачив', 'для скачивания']);
        } catch (Exception $e) {
            $downloadCategoryExternalId = '';
        }

        $pizzaCategoryIdForSizes = $pizzaCategoryId;
        try {
            $probePizzaSizeChildren = function($pid) use ($pdo) {
                $pid = $pid ? intval($pid) : 0;
                if ($pid <= 0) return [];
                $stmt = $pdo->prepare("SELECT id, name FROM categories WHERE parent_id = ?");
                $stmt->execute([$pid]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                $digits = [];
                foreach ($rows as $r) {
                    $nm = mb_strtolower(trim((string)($r['name'] ?? '')), 'UTF-8');
                    if ($nm === '') continue;
                    if (preg_match('/\b(\d{2})\b/u', $nm, $m)) {
                        $d = intval($m[1]);
                        if ($d > 0) $digits[$d] = true;
                    }
                }
                return array_keys($digits);
            };

            $currDigits = $probePizzaSizeChildren($pizzaCategoryIdForSizes);
            if (empty($currDigits)) {
                $cCols = $pdo->query("PRAGMA table_info(categories)")->fetchAll(PDO::FETCH_ASSOC);
                $cNames = array_column($cCols, 'name');
                $hasSlug = in_array('slug', $cNames, true);

                $sql = $hasSlug
                    ? "SELECT id, name, slug FROM categories WHERE name LIKE ? OR name LIKE ? OR slug LIKE ? OR slug LIKE ? ORDER BY id ASC"
                    : "SELECT id, name FROM categories WHERE name LIKE ? OR name LIKE ? ORDER BY id ASC";
                $stmt = $pdo->prepare($sql);
                if ($hasSlug) {
                    $stmt->execute(['%Пиц%', '%пиц%', '%pizza%', '%пиц%']);
                } else {
                    $stmt->execute(['%Пиц%', '%пиц%']);
                }
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $bestId = null;
                $bestScore = -1;
                foreach ($rows as $r) {
                    $cid = intval($r['id'] ?? 0);
                    if ($cid <= 0) continue;
                    $digits = $probePizzaSizeChildren($cid);
                    if (empty($digits)) continue;
                    $score = count($digits);
                    foreach ([25, 32, 42] as $need) {
                        if (in_array($need, $digits, true)) $score += 2;
                    }
                    if ($score > $bestScore) {
                        $bestScore = $score;
                        $bestId = $cid;
                    }
                }
                if ($bestId !== null && $bestId > 0) {
                    $pizzaCategoryIdForSizes = intval($bestId);
                }
            }
        } catch (Exception $e) {
            $pizzaCategoryIdForSizes = $pizzaCategoryId;
        }

        $pizzaSizeCategoryIds = [];
        $pizzaSizeCategoryLoaded = false;
        $detectPizzaSizeCategoryId = function($diameter) use ($pdo, $pizzaCategoryIdForSizes, &$pizzaSizeCategoryIds, &$pizzaSizeCategoryLoaded) {
            $d = intval($diameter);
            if ($d <= 0 || !$pizzaCategoryIdForSizes) return null;
            if (!$pizzaSizeCategoryLoaded) {
                $pizzaSizeCategoryLoaded = true;
                try {
                    $stmt = $pdo->prepare("SELECT id, name FROM categories WHERE parent_id = ?");
                    $stmt->execute([intval($pizzaCategoryIdForSizes)]);
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($rows as $r) {
                        $cid = intval($r['id'] ?? 0);
                        if ($cid <= 0) continue;
                        $nm = mb_strtolower(trim((string)($r['name'] ?? '')), 'UTF-8');
                        if ($nm === '') continue;
                        if (preg_match('/\b(\d{2})\b/u', $nm, $m)) {
                            $nd = intval($m[1]);
                            if ($nd > 0 && !isset($pizzaSizeCategoryIds[$nd])) {
                                $pizzaSizeCategoryIds[$nd] = $cid;
                            }
                        }
                    }
                } catch (Exception $e) {
                    // ignore
                }
            }
            return isset($pizzaSizeCategoryIds[$d]) ? intval($pizzaSizeCategoryIds[$d]) : null;
        };

        foreach ($modifierOffers as $offer) {
            $name = trim((string)($offer->name ?? ''));
            if ($name === '') continue;
            $sku = ymlOfferSku($offer);
            $price = floatval(str_replace(',', '.', (string)($offer->price ?? '0')));
            $desc = trim((string)($offer->description ?? ''));
            $pic = trim((string)($offer->picture ?? ''));

            $existingId = null;
            if ($sku !== '') {
                $stmt = $pdo->prepare("SELECT id FROM products WHERE sku = ? AND sku != '' LIMIT 1");
                $stmt->execute([$sku]);
                $r = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($r && isset($r['id'])) $existingId = intval($r['id']);
            }

            if ($existingId && $updateExisting) {
                $pdo->prepare("UPDATE products SET name = ?, description = COALESCE(?, description), image_url = COALESCE(?, image_url), price = ?, type = 'modifier', account_code = '43_mod', display_only = 0, parent_product_id = NULL, is_showcase_parent = 0, skip_inventory = 0, is_active = 1, visible_on_site = 1 WHERE id = ?")
                    ->execute([$name, ($desc !== '' ? $desc : null), ($pic !== '' ? $pic : null), $price, $existingId]);
                if ($modCategoryId) linkProductToCategoryId($pdo, $existingId, $modCategoryId);
                $stats['modifiers_updated']++;
            } elseif (!$existingId) {
                $pdo->prepare("INSERT INTO products (name, description, price, image_url, sku, type, account_code, display_only, parent_product_id, is_showcase_parent, skip_inventory, is_active, visible_on_site, created_at) VALUES (?, ?, ?, ?, ?, 'modifier', '43_mod', 0, NULL, 0, 0, 1, 1, datetime('now'))")
                    ->execute([$name, $desc, $price, ($pic !== '' ? $pic : null), ($sku !== '' ? $sku : null)]);
                $newId = intval($pdo->lastInsertId());
                if ($modCategoryId && $newId > 0) linkProductToCategoryId($pdo, $newId, $modCategoryId);
                $stats['modifiers_created']++;
            }
        }

        foreach ($singleOffers as $o) {
            $catExt = trim((string)($o->categoryId ?? ''));
            if ($catExt === '' || $catExt === $modifierCategoryExternalId) continue;
            $catId = isset($resolvedIds[$catExt]) ? intval($resolvedIds[$catExt]) : null;

            $name = trim((string)($o->name ?? ''));
            if ($name === '') continue;
            $sku = ymlOfferSku($o);
            $price = floatval(str_replace(',', '.', (string)($o->price ?? '0')));
            $desc = trim((string)($o->description ?? ''));
            $pic = trim((string)($o->picture ?? ''));

            $existingId = null;
            $existingIsShowcase = false;
            if ($sku !== '') {
                $stmt = $pdo->prepare("SELECT id, is_showcase_parent FROM products WHERE sku = ? AND sku != '' LIMIT 1");
                $stmt->execute([$sku]);
                $r = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($r && isset($r['id'])) {
                    $existingId = intval($r['id']);
                    $existingIsShowcase = !empty($r['is_showcase_parent']);
                }
            }

            if ($existingId && $updateExisting) {
                if ($existingIsShowcase) {
                    $pdo->prepare("UPDATE products SET name = ?, description = COALESCE(?, description), image_url = COALESCE(?, image_url), price = ?, type = 'product', category_id = COALESCE(?, category_id), is_active = 1, visible_on_site = 1 WHERE id = ?")
                        ->execute([$name, ($desc !== '' ? $desc : null), ($pic !== '' ? $pic : null), $price, ($catId ? $catId : null), $existingId]);
                } else {
                    $pdo->prepare("UPDATE products SET name = ?, description = COALESCE(?, description), image_url = COALESCE(?, image_url), price = ?, type = 'dish', account_code = COALESCE(account_code, '43'), display_only = 0, is_showcase_parent = 0, skip_inventory = 0, parent_product_id = NULL, group_id = NULL, category_id = COALESCE(?, category_id), is_active = 1, visible_on_site = 1 WHERE id = ?")
                        ->execute([$name, ($desc !== '' ? $desc : null), ($pic !== '' ? $pic : null), $price, ($catId ? $catId : null), $existingId]);
                }
                if ($catId) linkProductToCategoryId($pdo, $existingId, $catId);
                $stats['variants_updated']++;
            } elseif (!$existingId) {
                $pdo->prepare("INSERT INTO products (name, description, price, image_url, sku, type, account_code, display_only, is_showcase_parent, skip_inventory, parent_product_id, group_id, category_id, is_active, visible_on_site, created_at) VALUES (?, ?, ?, ?, ?, 'dish', '43', 0, 0, 0, NULL, NULL, ?, 1, 1, datetime('now'))")
                    ->execute([$name, $desc, $price, ($pic !== '' ? $pic : null), ($sku !== '' ? $sku : null), ($catId ? $catId : null)]);
                $newId = intval($pdo->lastInsertId());
                if ($catId && $newId > 0) linkProductToCategoryId($pdo, $newId, $catId);
                $stats['variants_created']++;
            }
        }

        foreach ($groups as $groupId => $offers) {
            if (!is_array($offers) || empty($offers)) continue;
            $first = $offers[0];
            $catExt = trim((string)($first->categoryId ?? ''));
            if ($catExt === $modifierCategoryExternalId) continue;
            $origCatId = isset($resolvedIds[$catExt]) ? intval($resolvedIds[$catExt]) : null;
            $catId = $origCatId;
            $forcedFromDownloadToPizza = false;
            if ($downloadCategoryExternalId !== '' && $catExt !== '' && $catExt === $downloadCategoryExternalId && $pizzaCategoryId) {
                $hasSized = false;
                foreach ($offers as $oo) {
                    $nm = trim((string)($oo->name ?? ''));
                    $sl = parseSizeLabelFromOffer($oo, $nm);
                    $dm = parseDiameterFromSizeLabel($sl);
                    if ($dm !== null && intval($dm) > 0) {
                        $hasSized = true;
                        break;
                    }
                }
                if ($hasSized) {
                    $catId = intval($pizzaCategoryId);
                    $forcedFromDownloadToPizza = true;
                }
            }

            $firstName = trim((string)($first->name ?? ''));
            $baseName = extractBaseNameFromSize($firstName);
            if ($baseName === '') $baseName = $firstName;

            $variantPrices = [];
            foreach ($offers as $o) {
                $p = floatval(str_replace(',', '.', (string)($o->price ?? '0')));
                if ($p > 0) $variantPrices[] = $p;
            }
            $minPrice = !empty($variantPrices) ? min($variantPrices) : floatval(str_replace(',', '.', (string)($first->price ?? '0')));

            $pSku = 'GRP-' . preg_replace('/[^0-9a-zA-Z_\-]+/', '-', (string)$groupId);
            $parentId = null;
            $existingParentId = null;
            $stmt = $pdo->prepare("SELECT id FROM products WHERE sku = ? LIMIT 1");
            $stmt->execute([$pSku]);
            $r = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($r && isset($r['id'])) $existingParentId = intval($r['id']);

            $desc = trim((string)($first->description ?? ''));
            $pic = trim((string)($first->picture ?? ''));

            if ($existingParentId && $updateExisting) {
                $pdo->prepare("UPDATE products SET name = ?, description = COALESCE(?, description), image_url = COALESCE(?, image_url), price = ?, type = 'product', display_only = 1, is_showcase_parent = 1, skip_inventory = 1, parent_product_id = NULL, group_id = ?, category_id = COALESCE(?, category_id), is_active = 1, visible_on_site = 1 WHERE id = ?")
                    ->execute([$baseName, ($desc !== '' ? $desc : null), ($pic !== '' ? $pic : null), $minPrice, $groupId, ($catId ? $catId : null), $existingParentId]);
                $parentId = $existingParentId;
                $stats['parents_updated']++;
            } elseif (!$existingParentId) {
                $pdo->prepare("INSERT INTO products (name, description, price, image_url, sku, type, display_only, is_showcase_parent, skip_inventory, parent_product_id, group_id, category_id, is_active, visible_on_site, created_at) VALUES (?, ?, ?, ?, ?, 'product', 1, 1, 1, NULL, ?, ?, 1, 1, datetime('now'))")
                    ->execute([$baseName, $desc, $minPrice, ($pic !== '' ? $pic : null), $pSku, $groupId, ($catId ? $catId : null)]);
                $parentId = intval($pdo->lastInsertId());
                $stats['parents_created']++;
            } else {
                $parentId = $existingParentId;
            }

            if ($parentId && $catId) linkProductToCategoryId($pdo, $parentId, $catId);
            if ($forcedFromDownloadToPizza && $parentId && $origCatId && intval($origCatId) !== intval($catId)) {
                try {
                    $pdo->prepare("DELETE FROM product_category WHERE product_id = ? AND category_id = ?")->execute([$parentId, intval($origCatId)]);
                } catch (Exception $e) {
                    // ignore
                }
            }

            foreach ($offers as $o) {
                // Для вариантов внутри группы используем ID оффера как SKU, чтобы гарантировать уникальность.
                // В YML нередко vendorCode одинаковый у всех размеров, а sku в БД UNIQUE.
                $vSku = ymlOfferId($o);
                if ($vSku === '') {
                    $vSku = ymlOfferSku($o);
                }
                $vName = trim((string)($o->name ?? $baseName));
                $vDesc = trim((string)($o->description ?? ''));
                $vPic = trim((string)($o->picture ?? $pic));
                $vPrice = floatval(str_replace(',', '.', (string)($o->price ?? '0')));
                if ($vPrice <= 0) $vPrice = $minPrice;

                $sizeLabel = parseSizeLabelFromOffer($o, $vName);
                // Если имя варианта не содержит размера, добавляем его для уникальности в админке.
                if ($sizeLabel !== '') {
                    $shortSize = preg_replace('/\s+/u', ' ', trim((string)$sizeLabel));
                    $hasSizeInName = preg_match('/\b(25|30|32|33|35|40|42)\b\s*(?:см|cm)/iu', (string)$vName);
                    if (!$hasSizeInName) {
                        $baseForName = extractBaseNameFromSize($vName);
                        if ($baseForName === '') $baseForName = $baseName;
                        $vName = trim($baseForName . ' ' . $shortSize);
                    }
                }
                $diameter = parseDiameterFromSizeLabel($sizeLabel);
                $coef = calculateRecipeCoefficientFromDiameter($diameter);

                $sizeCatId = null;
                if ($pizzaCategoryId && $diameter !== null) {
                    $sizeCatId = $detectPizzaSizeCategoryId(intval($diameter));
                }
                $variantCatId = $sizeCatId ? intval($sizeCatId) : ($catId ? intval($catId) : null);

                $existingVariantId = null;
                if ($vSku !== '') {
                    $stmt = $pdo->prepare("SELECT id FROM products WHERE sku = ? AND sku != '' LIMIT 1");
                    $stmt->execute([$vSku]);
                    $rv = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($rv && isset($rv['id'])) $existingVariantId = intval($rv['id']);
                }

                if ($existingVariantId && $updateExisting) {
                    $pdo->prepare("UPDATE products SET name = ?, description = COALESCE(?, description), image_url = COALESCE(?, image_url), price = ?, type = 'dish', account_code = '43', display_only = 0, is_showcase_parent = 0, skip_inventory = 0, parent_product_id = ?, group_id = ?, category_id = COALESCE(?, category_id), size_label = ?, diameter = ?, recipe_coefficient = ?, is_active = 1, visible_on_site = 1 WHERE id = ?")
                        ->execute([$vName, ($vDesc !== '' ? $vDesc : null), ($vPic !== '' ? $vPic : null), $vPrice, $parentId, $groupId, ($variantCatId ? $variantCatId : null), ($sizeLabel !== '' ? $sizeLabel : null), ($diameter !== null ? intval($diameter) : null), $coef, $existingVariantId]);
                    if ($variantCatId) linkProductToCategoryId($pdo, $existingVariantId, $variantCatId);
                    if ($forcedFromDownloadToPizza && $origCatId && intval($origCatId) !== intval($variantCatId)) {
                        try {
                            $pdo->prepare("DELETE FROM product_category WHERE product_id = ? AND category_id = ?")->execute([$existingVariantId, intval($origCatId)]);
                        } catch (Exception $e) {
                            // ignore
                        }
                    }
                    if ($sizeCatId && $catId && intval($sizeCatId) !== intval($catId)) {
                        try {
                            $pdo->prepare("DELETE FROM product_category WHERE product_id = ? AND category_id = ?")->execute([$existingVariantId, $catId]);
                        } catch (Exception $e) {
                            // ignore
                        }
                    }
                    $stats['variants_updated']++;
                } elseif (!$existingVariantId) {
                    $pdo->prepare("INSERT INTO products (name, description, price, image_url, sku, type, account_code, display_only, is_showcase_parent, skip_inventory, parent_product_id, group_id, category_id, size_label, diameter, recipe_coefficient, is_active, visible_on_site, created_at) VALUES (?, ?, ?, ?, ?, 'dish', '43', 0, 0, 0, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'))")
                        ->execute([$vName, $vDesc, $vPrice, ($vPic !== '' ? $vPic : null), ($vSku !== '' ? $vSku : null), $parentId, $groupId, ($variantCatId ? $variantCatId : null), ($sizeLabel !== '' ? $sizeLabel : null), ($diameter !== null ? intval($diameter) : null), $coef]);
                    $newVid = intval($pdo->lastInsertId());
                    if ($variantCatId && $newVid > 0) linkProductToCategoryId($pdo, $newVid, $variantCatId);
                    if ($forcedFromDownloadToPizza && $origCatId && $newVid > 0 && intval($origCatId) !== intval($variantCatId)) {
                        try {
                            $pdo->prepare("DELETE FROM product_category WHERE product_id = ? AND category_id = ?")->execute([$newVid, intval($origCatId)]);
                        } catch (Exception $e) {
                            // ignore
                        }
                    }
                    if ($sizeCatId && $catId && $newVid > 0 && intval($sizeCatId) !== intval($catId)) {
                        try {
                            $pdo->prepare("DELETE FROM product_category WHERE product_id = ? AND category_id = ?")->execute([$newVid, $catId]);
                        } catch (Exception $e) {
                            // ignore
                        }
                    }
                    $stats['variants_created']++;
                }
            }
        }

        $parents = [];
        try {
            $parentSet = [];
            $collectParentsByCategoryId = function($cid) use ($pdo, &$parentSet) {
                $cid = $cid ? intval($cid) : 0;
                if ($cid <= 0) return;
                $stmt = $pdo->prepare("SELECT DISTINCT p.id FROM products p INNER JOIN product_category pc ON pc.product_id = p.id WHERE pc.category_id = ? AND p.parent_product_id IS NULL AND (p.display_only = 1 OR p.is_showcase_parent = 1)");
                $stmt->execute([$cid]);
                $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);
                foreach ($rows as $rid) {
                    $pid = intval($rid);
                    if ($pid > 0) $parentSet[(string)$pid] = true;
                }
            };

            if ($pizzaCategoryId) {
                $collectParentsByCategoryId(intval($pizzaCategoryId));
            }
            if (isset($pizzaCategoryIdForSizes) && $pizzaCategoryIdForSizes && intval($pizzaCategoryIdForSizes) !== intval($pizzaCategoryId)) {
                $collectParentsByCategoryId(intval($pizzaCategoryIdForSizes));
            }

            if (isset($pizzaSizeCategoryIds) && is_array($pizzaSizeCategoryIds) && !empty($pizzaSizeCategoryIds)) {
                $sizeCatIds = array_values(array_unique(array_map('intval', $pizzaSizeCategoryIds)));
                $stmt = $pdo->prepare("SELECT DISTINCT parent_product_id FROM products p INNER JOIN product_category pc ON pc.product_id = p.id WHERE pc.category_id = ? AND p.parent_product_id IS NOT NULL");
                foreach ($sizeCatIds as $scid) {
                    if ($scid <= 0) continue;
                    $stmt->execute([$scid]);
                    $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);
                    foreach ($rows as $rid) {
                        $pid = intval($rid);
                        if ($pid > 0) $parentSet[(string)$pid] = true;
                    }
                }
            }

            $parents = array_map('intval', array_keys($parentSet));
        } catch (Exception $e) {
            $parents = [];
        }

        $mods = [];
        $stmt = $pdo->query("SELECT id FROM products WHERE type = 'modifier'");
        $mods = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

        if (!empty($parents) && !empty($mods)) {
            $ins = $pdo->prepare("INSERT OR IGNORE INTO item_modifiers (item_id, modifier_id, min_quantity, max_quantity, is_default, sort_order) VALUES (?, ?, 0, 10, 0, ?)");
            foreach ($parents as $pid) {
                $i = 0;
                foreach ($mods as $mid) {
                    $ins->execute([$pid, $mid, $i]);
                    if ($ins->rowCount() > 0) $stats['links_created']++;
                    $i++;
                }
            }
        }

        $pdo->commit();
        return $stats;
    } catch (Exception $e) {
        try {
            $pdo->rollBack();
        } catch (Exception $e2) {
            // ignore
        }
        throw $e;
    }
}

function handleStorefrontCategories($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }

    try {
        $stmt = $pdo->query("SELECT id, external_id, name, parent_id, position, show_on_site FROM categories WHERE show_on_site = 1 ORDER BY COALESCE(parent_id, 0), position, name");
        $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

        $byParent = [];
        foreach ($rows as $c) {
            $pid = array_key_exists('parent_id', $c) ? $c['parent_id'] : null;
            $key = ($pid === null) ? 'root' : strval(intval($pid));
            if (!isset($byParent[$key])) $byParent[$key] = [];
            $byParent[$key][] = $c;
        }

        $build = function($parentKey) use (&$build, $byParent) {
            $list = $byParent[$parentKey] ?? [];
            $out = [];
            foreach ($list as $c) {
                $id = intval($c['id'] ?? 0);
                $out[] = [
                    'id' => $id,
                    'external_id' => $c['external_id'] ?? null,
                    'name' => $c['name'] ?? '',
                    'parent_id' => ($c['parent_id'] !== null) ? intval($c['parent_id']) : null,
                    'children' => $build(strval($id))
                ];
            }
            return $out;
        };

        echo json_encode(['success' => true, 'ok' => true, 'data' => $build('root')]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleStorefrontItems($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }

    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 1000;
    if ($limit <= 0) $limit = 1000;
    if ($limit > 5000) $limit = 5000;

    $categoryId = isset($_GET['category_id']) ? intval($_GET['category_id']) : 0;
    if ($categoryId <= 0 && isset($_GET['category_external_id'])) {
        $ext = trim((string)$_GET['category_external_id']);
        if ($ext !== '') {
            try {
                $cStmt = $pdo->prepare("SELECT id FROM categories WHERE external_id = ? LIMIT 1");
                $cStmt->execute([$ext]);
                $cRow = $cStmt->fetch(PDO::FETCH_ASSOC);
                if ($cRow && isset($cRow['id'])) {
                    $categoryId = intval($cRow['id']);
                }
            } catch (Exception $e) {
                $categoryId = 0;
            }
        }
    }

    try {
        if ($categoryId > 0) {
            $pStmt = $pdo->prepare("\
                SELECT DISTINCT p.*\
                FROM products p\
                INNER JOIN product_category pc ON pc.product_id = p.id\
                WHERE pc.category_id = ?\
                  AND p.parent_product_id IS NULL\
                  AND (p.display_only = 1 OR p.is_showcase_parent = 1)\
                  AND COALESCE(p.type, 'product') != 'modifier'\
                  AND COALESCE(p.is_active, 1) = 1\
                  AND COALESCE(p.visible_on_site, 1) = 1\
                ORDER BY COALESCE(p.sort_order, 0), p.name\
                LIMIT ?\
            ");
            $pStmt->bindValue(1, $categoryId, PDO::PARAM_INT);
            $pStmt->bindValue(2, $limit, PDO::PARAM_INT);
            $pStmt->execute();
        } else {
            $pStmt = $pdo->prepare("\
                SELECT * FROM products\
                WHERE parent_product_id IS NULL\
                  AND (display_only = 1 OR is_showcase_parent = 1)\
                  AND COALESCE(type, 'product') != 'modifier'\
                  AND COALESCE(is_active, 1) = 1\
                  AND COALESCE(visible_on_site, 1) = 1\
                ORDER BY COALESCE(sort_order, 0), name\
                LIMIT ?\
            ");
            $pStmt->bindValue(1, $limit, PDO::PARAM_INT);
            $pStmt->execute();
        }

        $parents = $pStmt->fetchAll(PDO::FETCH_ASSOC);

        $variantsStmt = $pdo->prepare("\
            SELECT * FROM products\
            WHERE parent_product_id = ?\
              AND COALESCE(is_active, 1) = 1\
              AND COALESCE(visible_on_site, 1) = 1\
            ORDER BY COALESCE(diameter, 0), COALESCE(size_label, ''), name\
        ");

        $modsStmt = $pdo->prepare("\
            SELECT m.*, im.min_quantity, im.max_quantity, im.is_default, im.sort_order\
            FROM item_modifiers im\
            INNER JOIN products m ON m.id = im.modifier_id\
            WHERE im.item_id = ?\
              AND COALESCE(m.type, '') = 'modifier'\
              AND COALESCE(m.is_active, 1) = 1\
              AND COALESCE(m.visible_on_site, 1) = 1\
            ORDER BY COALESCE(im.sort_order, 0), m.name\
        ");

        $out = [];
        foreach ($parents as $p) {
            $pid = intval($p['id'] ?? 0);
            if ($pid <= 0) continue;

            $variantsStmt->execute([$pid]);
            $variants = $variantsStmt->fetchAll(PDO::FETCH_ASSOC);

            $modsStmt->execute([$pid]);
            $mods = $modsStmt->fetchAll(PDO::FETCH_ASSOC);

            $priceFrom = null;
            foreach ($variants as $v) {
                $vp = isset($v['price']) ? floatval($v['price']) : null;
                if ($vp === null || $vp <= 0) continue;
                if ($priceFrom === null || $vp < $priceFrom) $priceFrom = $vp;
            }
            if ($priceFrom === null) {
                $priceFrom = isset($p['price']) ? floatval($p['price']) : 0;
            }

            $out[] = [
                'id' => $pid,
                'name' => $p['name'] ?? '',
                'description' => $p['description'] ?? '',
                'image_url' => $p['image_url'] ?? null,
                'price_from' => $priceFrom,
                'variants' => $variants,
                'modifiers' => $mods
            ];
        }

        echo json_encode(['success' => true, 'ok' => true, 'data' => $out]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleStorefrontItemById($pdo, $id) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }

    $id = intval($id);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid id']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Item not found']);
            return;
        }

        $parentId = isset($row['parent_product_id']) && $row['parent_product_id'] !== null ? intval($row['parent_product_id']) : $id;
        if ($parentId !== $id) {
            $pStmt = $pdo->prepare("SELECT * FROM products WHERE id = ? LIMIT 1");
            $pStmt->execute([$parentId]);
            $pRow = $pStmt->fetch(PDO::FETCH_ASSOC);
            if ($pRow) {
                $row = $pRow;
            }
        }

        $variantsStmt = $pdo->prepare("SELECT * FROM products WHERE parent_product_id = ? AND COALESCE(is_active, 1) = 1 AND COALESCE(visible_on_site, 1) = 1 ORDER BY COALESCE(diameter, 0), COALESCE(size_label, ''), name");
        $variantsStmt->execute([$parentId]);
        $variants = $variantsStmt->fetchAll(PDO::FETCH_ASSOC);

        $modsStmt = $pdo->prepare("SELECT m.*, im.min_quantity, im.max_quantity, im.is_default, im.sort_order FROM item_modifiers im INNER JOIN products m ON m.id = im.modifier_id WHERE im.item_id = ? AND COALESCE(m.type, '') = 'modifier' AND COALESCE(m.is_active, 1) = 1 AND COALESCE(m.visible_on_site, 1) = 1 ORDER BY COALESCE(im.sort_order, 0), m.name");
        $modsStmt->execute([$parentId]);
        $mods = $modsStmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'ok' => true,
            'data' => [
                'item' => $row,
                'variants' => $variants,
                'modifiers' => $mods
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleItemModifiers($pdo, $itemId, $modifierId = null) {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $itemId = intval($itemId);
    $modifierId = $modifierId !== null ? intval($modifierId) : null;

    if ($itemId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid item_id']);
        return;
    }

    try {
        if ($method === 'GET') {
            $stmt = $pdo->prepare("\
                SELECT m.*, im.min_quantity, im.max_quantity, im.is_default, im.sort_order\
                FROM item_modifiers im\
                INNER JOIN products m ON m.id = im.modifier_id\
                WHERE im.item_id = ?\
                ORDER BY COALESCE(im.sort_order, 0), m.name\
            ");
            $stmt->execute([$itemId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'ok' => true, 'data' => $rows]);
            return;
        }

        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) $body = [];

        if ($modifierId === null) {
            $modifierId = isset($body['modifier_id']) ? intval($body['modifier_id']) : null;
        }
        if ($modifierId === null || $modifierId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'modifier_id is required']);
            return;
        }

        $minQ = isset($body['min_quantity']) ? intval($body['min_quantity']) : 0;
        $maxQ = isset($body['max_quantity']) ? intval($body['max_quantity']) : 10;
        $isDef = isset($body['is_default']) ? (intval($body['is_default']) ? 1 : 0) : 0;
        $sort = isset($body['sort_order']) ? intval($body['sort_order']) : 0;

        if ($minQ < 0) $minQ = 0;
        if ($maxQ < $minQ) $maxQ = $minQ;
        if ($maxQ > 999) $maxQ = 999;

        if ($method === 'POST') {
            $stmt = $pdo->prepare("INSERT OR IGNORE INTO item_modifiers (item_id, modifier_id, min_quantity, max_quantity, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$itemId, $modifierId, $minQ, $maxQ, $isDef, $sort]);
            if ($stmt->rowCount() === 0) {
                $u = $pdo->prepare("UPDATE item_modifiers SET min_quantity = ?, max_quantity = ?, is_default = ?, sort_order = ? WHERE item_id = ? AND modifier_id = ?");
                $u->execute([$minQ, $maxQ, $isDef, $sort, $itemId, $modifierId]);
            }
        } elseif ($method === 'PUT') {
            $u = $pdo->prepare("UPDATE item_modifiers SET min_quantity = ?, max_quantity = ?, is_default = ?, sort_order = ? WHERE item_id = ? AND modifier_id = ?");
            $u->execute([$minQ, $maxQ, $isDef, $sort, $itemId, $modifierId]);
            if ($u->rowCount() === 0) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Link not found']);
                return;
            }
        } elseif ($method === 'DELETE') {
            $d = $pdo->prepare("DELETE FROM item_modifiers WHERE item_id = ? AND modifier_id = ?");
            $d->execute([$itemId, $modifierId]);
            if ($d->rowCount() === 0) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Link not found']);
                return;
            }
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
            return;
        }

        $stmt = $pdo->prepare("SELECT * FROM item_modifiers WHERE item_id = ? AND modifier_id = ? LIMIT 1");
        $stmt->execute([$itemId, $modifierId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'ok' => true, 'data' => $row]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Process CSV file
 */
function processCSVFile($pdo, $filePath, $updateExisting, $importHidden, $logPath, $defaultAccountCode = '', $defaultSupplierName = '', $defaultContractNumber = '', $defaultPaymentTermDays = 0, $defaultWarehouseId = 1, $fieldMappingOverride = null) {
    $created = 0;
    $updated = 0;
    $errors = 0;
    $errorMessages = [];
    $receiptAccumulator = [];
    $receiptMeta = [
        'source' => 'import_products',
        'supplier_name' => $defaultSupplierName,
        'contract_number' => $defaultContractNumber,
        'payment_term_days' => $defaultPaymentTermDays
    ];
    
    if (($handle = fopen($filePath, 'r')) === false) {
        throw new Exception('Не удалось открыть CSV файл');
    }
    
    $csvDelimiterOverride = func_num_args() >= 12 ? (string)(func_get_arg(11) ?? '') : '';
    $csvStartRow = func_num_args() >= 13 ? intval(func_get_arg(12) ?? 2) : 2;
    $csvEncoding = func_num_args() >= 14 ? (string)(func_get_arg(13) ?? '') : '';
    if ($csvStartRow < 2) $csvStartRow = 2;

    $enc = $csvEncoding !== '' ? strtoupper(trim($csvEncoding)) : '';
    if ($enc === 'WINDOWS-1251') $enc = 'CP1251';
    $needConvert = ($enc !== '' && $enc !== 'UTF-8');
    $toUtf8 = function($s) use ($needConvert, $enc) {
        if (!$needConvert) return $s;
        $str = (string)$s;
        if ($str === '') return $str;
        if (function_exists('mb_convert_encoding')) {
            return mb_convert_encoding($str, 'UTF-8', $enc);
        }
        return $str;
    };

    $headerLineNumber = max(1, $csvStartRow - 1);
    $currentLineNumber = 0;
    $headerLine = null;
    while (($line = fgets($handle)) !== false) {
        $currentLineNumber++;
        if (trim((string)$line) === '') continue;
        if ($currentLineNumber === $headerLineNumber) {
            $headerLine = $toUtf8($line);
            break;
        }
    }
    if ($headerLine === null || trim($headerLine) === '') {
        if (is_resource($handle)) {
            fclose($handle);
        }
        $handle = null;
        throw new Exception('CSV файл пуст или не содержит заголовков');
    }

    $csvDelimiter = $csvDelimiterOverride !== '' ? $csvDelimiterOverride : detectCsvDelimiterFromLine($headerLine);
    $headers = str_getcsv($headerLine, $csvDelimiter);
    if ($headers === false || empty($headers)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        $handle = null;
        throw new Exception('CSV файл пуст или не содержит заголовков');
    }

    $headers = array_map(function($h) use ($toUtf8) {
        return trim($toUtf8($h));
    }, $headers);

    $fieldMapping = [
        'id' => null,
        'name' => null,
        'price' => null,
        'purchase_price' => null,
        'sale_price' => null,
        'description' => null,
        'category' => null,
        'category_path' => null,
        'image_url' => null,
        'image' => null,
        'picture' => null,
        'sku' => null,
        'external_id' => null,
        'parent_id' => null,
        'parameters' => null,
        'is_visible' => null,
        'available' => null,
        'weight' => null,
        'calories' => null,
        'cost' => null,
        'себестоимость' => null,
        'account_code' => null,
        'stock_qty' => null,
        'unit' => null,
        'ingredients' => null,
        'supplier' => null,
        'contract' => null,
        'display_only' => null,
        'parent_sku' => null,
        'variant_param' => null,
        'diameter' => null,
        'group' => null
    ];

    $mappingBySystem = [];
    if (is_array($fieldMappingOverride) && !empty($fieldMappingOverride)) {
        foreach ($fieldMappingOverride as $k => $v) {
            if ($k === null || $v === null) continue;
            $ks = trim((string)$k);
            $vs = trim((string)$v);
            if ($ks === '' || $vs === '') continue;

            if (preg_match('/^[a-z_]+$/', $ks)) {
                $mappingBySystem[$ks] = $vs;
            } else {
                if (preg_match('/^[a-z_]+$/', $vs)) {
                    $mappingBySystem[$vs] = $ks;
                }
            }
        }
    }

    if (!empty($mappingBySystem)) {
        $headersLowerMap = [];
        foreach ($headers as $idx => $h) {
            $headersLowerMap[mb_strtolower(trim((string)$h))] = $idx;
        }
        foreach ($mappingBySystem as $sys => $hdr) {
            $hdrLower = mb_strtolower(trim((string)$hdr));
            if ($hdrLower === '') continue;
            if (isset($headersLowerMap[$hdrLower])) {
                $fieldMapping[$sys] = intval($headersLowerMap[$hdrLower]);
            }
        }
    }

    foreach ($headers as $index => $header) {
        $headerLower = mb_strtolower(trim($header));
        if ($fieldMapping['id'] === null && in_array($headerLower, ['id', 'product_id', 'offer_id'])) {
            $fieldMapping['id'] = $index;
        } elseif ($fieldMapping['external_id'] === null && in_array($headerLower, ['external_id', 'externalid', 'ext_id'])) {
            $fieldMapping['external_id'] = $index;
        } elseif ($fieldMapping['parent_id'] === null && in_array($headerLower, ['parent_id', 'parentid', 'parent'])) {
            $fieldMapping['parent_id'] = $index;
        } elseif ($fieldMapping['parameters'] === null && in_array($headerLower, ['parameters', 'params', 'параметры'])) {
            $fieldMapping['parameters'] = $index;
        } elseif ($fieldMapping['is_visible'] === null && in_array($headerLower, ['is_visible', 'isvisible', 'visible', 'видимость', 'показывать'])) {
            $fieldMapping['is_visible'] = $index;
        }
        if ($fieldMapping['name'] === null && in_array($headerLower, ['название', 'name', 'имя', 'product'])) {
            $fieldMapping['name'] = $index;
        } elseif ($fieldMapping['price'] === null && in_array($headerLower, ['цена', 'price'])) {
            $fieldMapping['price'] = $index;
        } elseif ($fieldMapping['purchase_price'] === null && in_array($headerLower, ['purchase_price', 'закуп', 'закупочная', 'закупочнаяцена', 'закупочная_цена'])) {
            $fieldMapping['purchase_price'] = $index;
        } elseif ($fieldMapping['sale_price'] === null && in_array($headerLower, ['sale_price', 'продажа', 'розница', 'розничная', 'розничнаяцена', 'розничная_цена'])) {
            $fieldMapping['sale_price'] = $index;
        } elseif (($fieldMapping['sale_price'] === null || $fieldMapping['purchase_price'] === null) && mb_strpos($headerLower, 'закуп') !== false && mb_strpos($headerLower, 'продаж') !== false) {
            $fieldMapping['sale_price'] = $index;
            $fieldMapping['purchase_price'] = $index;
        } elseif ($fieldMapping['cost'] === null && in_array($headerLower, ['себестоимость', 'cost', 'себест', 'purchase_price'])) {
            $fieldMapping['cost'] = $index;
            $fieldMapping['себестоимость'] = $index;
        } elseif ($fieldMapping['account_code'] === null && ($headerLower === 'account_code' || $headerLower === 'accountcode' || ($headerLower !== '' && (mb_strpos($headerLower, 'тип') !== false) && (mb_strpos($headerLower, 'счет') !== false || mb_strpos($headerLower, 'счёт') !== false)))) {
            $fieldMapping['account_code'] = $index;
        } elseif ($fieldMapping['description'] === null && in_array($headerLower, ['описание', 'description', 'desc', 'опис'])) {
            $fieldMapping['description'] = $index;
        } elseif (($fieldMapping['category'] === null || $fieldMapping['category_path'] === null) && in_array($headerLower, ['категория', 'category', 'cat', 'кат'])) {
            $fieldMapping['category'] = $index;
            $fieldMapping['category_path'] = $index;
        } elseif ($fieldMapping['category_path'] === null && ($headerLower === 'category_path' || $headerLower === 'categorypath')) {
            $fieldMapping['category_path'] = $index;
        } elseif ($fieldMapping['image_url'] === null && in_array($headerLower, ['изображение', 'image', 'img', 'picture', 'photo', 'картинка'])) {
            $fieldMapping['image_url'] = $index;
        } elseif ($fieldMapping['sku'] === null && in_array($headerLower, ['артикул', 'sku', 'code', 'код'])) {
            $fieldMapping['sku'] = $index;
        } elseif ($fieldMapping['weight'] === null && in_array($headerLower, ['вес', 'weight', 'масса'])) {
            $fieldMapping['weight'] = $index;
        } elseif ($fieldMapping['calories'] === null && in_array($headerLower, ['калории', 'calories', 'ккал', 'kcal'])) {
            $fieldMapping['calories'] = $index;
        } elseif ($fieldMapping['available'] === null && in_array($headerLower, ['available', 'доступно', 'есть', 'наличие'])) {
            $fieldMapping['available'] = $index;
        } elseif ($fieldMapping['stock_qty'] === null && in_array($headerLower, ['stock_qty', 'qty', 'остаток', 'количество', 'кол-во'])) {
            $fieldMapping['stock_qty'] = $index;
        } elseif ($fieldMapping['unit'] === null && in_array($headerLower, ['unit', 'ед', 'ед.', 'ед.изм', 'ед изм', 'едизм'])) {
            $fieldMapping['unit'] = $index;
        } elseif ($fieldMapping['ingredients'] === null && (in_array($headerLower, ['ingredients', 'состав', 'ингредиенты']) || mb_strpos($headerLower, 'состав') !== false)) {
            $fieldMapping['ingredients'] = $index;
        } elseif ($fieldMapping['supplier'] === null && (in_array($headerLower, ['supplier', 'поставщик']) || mb_strpos($headerLower, 'постав') !== false)) {
            $fieldMapping['supplier'] = $index;
        } elseif ($fieldMapping['contract'] === null && (in_array($headerLower, ['contract', 'договор']) || mb_strpos($headerLower, 'договор') !== false)) {
            $fieldMapping['contract'] = $index;
        } elseif ($fieldMapping['display_only'] === null && (in_array($headerLower, ['display_only', 'витрина', 'витринный', 'витринное']) || mb_strpos($headerLower, 'витрин') !== false)) {
            $fieldMapping['display_only'] = $index;
        } elseif ($fieldMapping['parent_sku'] === null && (in_array($headerLower, ['parent_sku', 'parent', 'родитель', 'родительский']) || mb_strpos($headerLower, 'родител') !== false)) {
            $fieldMapping['parent_sku'] = $index;
        } elseif ($fieldMapping['variant_param'] === null && (in_array($headerLower, ['variant_param', 'variant', 'вариант', 'размер']) || mb_strpos($headerLower, 'вариант') !== false)) {
            $fieldMapping['variant_param'] = $index;
        } elseif ($fieldMapping['diameter'] === null && in_array($headerLower, ['diameter', 'диаметр', 'размер', 'size', 'cm', 'см'])) {
            $fieldMapping['diameter'] = $index;
        } elseif ($fieldMapping['group'] === null && ($headerLower === 'group' || $headerLower === 'group_name' || $headerLower === 'group_id' || mb_strpos($headerLower, 'группа') !== false)) {
            $fieldMapping['group'] = $index;
        }
    }

    if ($fieldMapping['name'] === null) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        $handle = null;
        throw new Exception('Не найдена колонка с названием товара. Ожидаемые заголовки: название, name, имя, product');
    }

    if ($fieldMapping['price'] === null && $fieldMapping['purchase_price'] === null && $fieldMapping['sale_price'] === null) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        $handle = null;
        throw new Exception('Не найдена колонка с ценой. Ожидаемые заголовки: цена/price или Закуп / Продажа');
    }

    try {
        $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_column($columns, 'name');
        if (!in_array('cost', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN cost DECIMAL(10,2)");
        }
        if (!in_array('account_code', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN account_code TEXT");
        }
        if (!in_array('purchase_price', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN purchase_price DECIMAL(10,2)");
        }
        if (!in_array('sale_price', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN sale_price DECIMAL(10,2)");
        }
        if (!in_array('stock_qty', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN stock_qty DECIMAL(10,3)");
        }
        if (!in_array('unit', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN unit TEXT");
        }
        if (!in_array('category_path', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN category_path TEXT");
        }
        if (!in_array('ingredients', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN ingredients TEXT");
        }
        if (!in_array('supplier_code', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN supplier_code TEXT");
        }
        if (!in_array('contract_number', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN contract_number TEXT");
        }
        if (!in_array('payment_term_days', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN payment_term_days INTEGER");
        }
        if (!in_array('group_id', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN group_id INTEGER");
        }

        $pdo->exec("CREATE TABLE IF NOT EXISTS suppliers (supplier_code TEXT PRIMARY KEY, name TEXT NOT NULL, tax_id TEXT, address TEXT, contact_person TEXT, email TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)");

        $pdo->exec("CREATE TABLE IF NOT EXISTS supplier_contracts (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_code TEXT NOT NULL, contract_number TEXT NOT NULL, payment_term_days INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE (supplier_code, contract_number), FOREIGN KEY (supplier_code) REFERENCES suppliers(supplier_code) ON DELETE CASCADE)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_supplier_contracts_supplier ON supplier_contracts(supplier_code)");
    } catch (Exception $e) {
        // ignore
    }

    $insertStmt = $pdo->prepare("
        INSERT INTO products (name, description, price, category, image_url, available, sku, weight, calories, cost, purchase_price, sale_price, stock_qty, unit, category_path, ingredients, supplier_code, contract_number, payment_term_days, account_code, group_id, visible_on_site, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ");

    $updateStmt = null;
    if ($updateExisting) {
        $updateStmt = $pdo->prepare("
            UPDATE products 
            SET name = ?, price = ?, category = ?, available = ?, sku = ?, weight = ?, calories = ?, cost = ?, purchase_price = ?, sale_price = ?, stock_qty = ?, unit = ?, category_path = ?, description = COALESCE(?, description), image_url = COALESCE(?, image_url), ingredients = COALESCE(?, ingredients), supplier_code = COALESCE(?, supplier_code), contract_number = COALESCE(?, contract_number), payment_term_days = COALESCE(?, payment_term_days), account_code = COALESCE(?, account_code), group_id = COALESCE(?, group_id)
            WHERE id = ?
        ");
    }

    $categoryCheckStmt = $pdo->prepare("SELECT id FROM categories WHERE name = ? OR slug = ? LIMIT 1");
    $categoryInsertStmt = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
    $categoryUpsertStmt = $pdo->prepare("INSERT INTO categories (name, slug, parent_id, type, show_on_site, show_in_nav, position) VALUES (?, ?, ?, ?, 1, 1, 0)");
    $categoryFindBySlugStmt = $pdo->prepare("SELECT id FROM categories WHERE slug = ? LIMIT 1");
    $categoryFindByParentAndNameStmt = $pdo->prepare("SELECT id, slug FROM categories WHERE parent_id IS ? AND name = ? LIMIT 1");

    $supplierUpsertStmt = $pdo->prepare("INSERT OR IGNORE INTO suppliers (supplier_code, name) VALUES (?, ?)");
    $contractUpsertStmt = $pdo->prepare("INSERT OR IGNORE INTO supplier_contracts (supplier_code, contract_number, payment_term_days) VALUES (?, ?, ?)");

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS product_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id INTEGER, name TEXT NOT NULL, slug TEXT UNIQUE, default_unit TEXT, default_category_stock INTEGER, default_account TEXT, default_tax_group TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    } catch (Exception $e) {
        // ignore
    }
    $productGroupFindStmt = $pdo->prepare("SELECT id FROM product_groups WHERE parent_id IS ? AND name = ? LIMIT 1");
    $productGroupInsertStmt = $pdo->prepare("INSERT INTO product_groups (name, slug, parent_id, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))");

    $skuPrefixMax = [];
    $skuCheckStmt = $pdo->prepare("SELECT sku FROM products WHERE sku LIKE ?");
    $findExistingBySkuStmt = $pdo->prepare("SELECT id, description, image_url FROM products WHERE sku = ? AND sku != '' LIMIT 1");

    $allRows = [];
    $lineNumber = $currentLineNumber;
    $maxRows = 50000;
    while ($lineNumber < $csvStartRow - 1 && fgets($handle) !== false) {
        $lineNumber++;
    }
    while (($row = fgetcsv($handle, 0, $csvDelimiter)) !== false) {
        $lineNumber++;
        if ($needConvert && is_array($row)) {
            $row = array_map($toUtf8, $row);
        }
        if (($lineNumber - 1) > $maxRows) {
            $errors++;
            $errorMessages[] = "Превышен лимит строк: максимум {$maxRows} строк данных";
            break;
        }
        if (count($row) < count($headers)) {
            $row = array_pad($row, count($headers), '');
        }
        $allRows[] = ['row' => $row, 'lineNumber' => $lineNumber];
    }
    if (is_resource($handle)) {
        fclose($handle);
    }
    $handle = null;

    $parentRows = [];
    $variantRows = [];
    $regularRows = [];

    $csvHasParentId = ($fieldMapping['parent_id'] !== null);
    $csvParentsWithChildren = [];
    foreach ($allRows as $rowData) {
        $row = $rowData['row'];
        $displayOnlyRaw = trim($row[$fieldMapping['display_only'] ?? -1] ?? '');
        $parentSkuRaw = trim($row[$fieldMapping['parent_sku'] ?? -1] ?? '');
        $parentIdRaw = $csvHasParentId ? trim($row[$fieldMapping['parent_id'] ?? -1] ?? '') : '';
        $isDisplayOnly = false;
        if ($displayOnlyRaw !== '') {
            $displayOnlyLower = mb_strtolower($displayOnlyRaw);
            $isDisplayOnly = in_array($displayOnlyLower, ['1', 'true', 'yes', 'да', 'on', 'истина']);
        }
        if ($parentIdRaw !== '') {
            $csvParentsWithChildren[$parentIdRaw] = true;
            $variantRows[] = $rowData;
        } elseif ($isDisplayOnly) {
            $parentRows[] = $rowData;
        } elseif ($parentSkuRaw !== '') {
            $variantRows[] = $rowData;
        } else {
            $regularRows[] = $rowData;
        }
    }
    $rowsToProcess = array_merge($parentRows, $regularRows, $variantRows);

    $productColumns = [];
    try {
        $cStmt = $pdo->query("PRAGMA table_info(products)");
        $cRows = $cStmt ? $cStmt->fetchAll(PDO::FETCH_ASSOC) : [];
        foreach ($cRows as $cr) {
            if (isset($cr['name'])) $productColumns[$cr['name']] = true;
        }
    } catch (Exception $e) {
        $productColumns = [];
    }

    $hasParentProductId = isset($productColumns['parent_product_id']);
    $hasIsShowcaseParent = isset($productColumns['is_showcase_parent']);
    $hasDisplayOnlyCol = isset($productColumns['display_only']);
    $hasSkipInventory = isset($productColumns['skip_inventory']);
    $hasSizeLabel = isset($productColumns['size_label']);
    $hasDiameterCol = isset($productColumns['diameter']);
    $hasVisibleOnSite = isset($productColumns['visible_on_site']);
    $hasIsActive = isset($productColumns['is_active']);
    $hasType = isset($productColumns['type']);
    $hasAccountCode = isset($productColumns['account_code']);

    $csvExternalToInternal = [];

    $findProductByIdStmt = $pdo->prepare("SELECT id FROM products WHERE id = ? LIMIT 1");

    foreach ($rowsToProcess as $rowData) {
        $row = $rowData['row'];
        $lineNumber = $rowData['lineNumber'];

        try {
            if (count($row) < count($headers)) {
                $row = array_pad($row, count($headers), '');
            }

            $name = trim($row[$fieldMapping['name']] ?? '');
            $priceRaw = trim($row[$fieldMapping['price']] ?? '');
            $description = trim($row[$fieldMapping['description']] ?? '');
            $category = trim($row[$fieldMapping['category']] ?? '');
            $categoryPath = trim($row[$fieldMapping['category_path']] ?? $category);
            $imageUrl = trim($row[$fieldMapping['image_url']] ?? '');
            $sku = trim($row[$fieldMapping['sku']] ?? '');
            $skuColumnExists = ($fieldMapping['sku'] !== null);
            $skuProvided = ($skuColumnExists && $sku !== '');
            $available = trim($row[$fieldMapping['available']] ?? '');
            $weight = trim($row[$fieldMapping['weight']] ?? '');
            $calories = trim($row[$fieldMapping['calories']] ?? '');
            $cost = trim($row[$fieldMapping['cost']] ?? $row[$fieldMapping['себестоимость']] ?? '');
            $accountCodeRaw = trim($row[$fieldMapping['account_code']] ?? '');
            $stockQtyRaw = trim($row[$fieldMapping['stock_qty']] ?? '');
            $unitRaw = trim($row[$fieldMapping['unit']] ?? '');
            $ingredientsRaw = trim($row[$fieldMapping['ingredients']] ?? '');
            $supplierRaw = trim($row[$fieldMapping['supplier']] ?? '');
            $contractRaw = trim($row[$fieldMapping['contract']] ?? '');
            $groupRaw = trim($row[$fieldMapping['group']] ?? '');

            $displayOnlyRaw = trim($row[$fieldMapping['display_only']] ?? '');
            $parentSkuRaw = trim($row[$fieldMapping['parent_sku']] ?? '');
            $variantParamRaw = trim($row[$fieldMapping['variant_param']] ?? '');
            $diameterRaw = trim($row[$fieldMapping['diameter']] ?? '');

            $csvIdRaw = trim($row[$fieldMapping['id'] ?? -1] ?? '');
            $csvExternalIdRaw = trim($row[$fieldMapping['external_id'] ?? -1] ?? '');
            $csvParentIdRaw = trim($row[$fieldMapping['parent_id'] ?? -1] ?? '');
            $csvParametersRaw = trim($row[$fieldMapping['parameters'] ?? -1] ?? '');
            $csvVisibleRaw = trim($row[$fieldMapping['is_visible'] ?? -1] ?? '');

            $csvKey = $csvExternalIdRaw !== '' ? $csvExternalIdRaw : $csvIdRaw;

            $displayOnly = 0;
            if ($displayOnlyRaw !== '') {
                $displayOnlyLower = mb_strtolower($displayOnlyRaw);
                if (in_array($displayOnlyLower, ['1', 'true', 'yes', 'да', 'on', 'истина'])) {
                    $displayOnly = 1;
                }
            }

            $csvVisibleOnSite = null;
            if ($csvVisibleRaw !== '') {
                $csvVisibleLower = mb_strtolower($csvVisibleRaw);
                $csvVisibleOnSite = in_array($csvVisibleLower, ['1', 'true', 'yes', 'да', 'on', 'истина'], true) ? 1 : 0;
            }

            if ($supplierRaw === '' && $defaultSupplierName !== '') {
                $supplierRaw = $defaultSupplierName;
            }
            if ($contractRaw === '' && $defaultContractNumber !== '') {
                $contractRaw = $defaultContractNumber;
                if ($defaultPaymentTermDays > 0) {
                    $contractRaw = $contractRaw . ' / ' . strval(intval($defaultPaymentTermDays));
                }
            }

            $purchasePriceRaw = trim($row[$fieldMapping['purchase_price']] ?? '');
            $salePriceRaw = trim($row[$fieldMapping['sale_price']] ?? '');
            if (($fieldMapping['purchase_price'] === $fieldMapping['sale_price']) && $fieldMapping['purchase_price'] !== null) {
                $pair = trim($row[$fieldMapping['purchase_price']] ?? '');
                if ($pair !== '' && (mb_strpos($pair, '/') !== false)) {
                    $parts = array_map('trim', explode('/', $pair, 2));
                    $purchasePriceRaw = $parts[0] ?? '';
                    $salePriceRaw = $parts[1] ?? '';
                }
            }

            $accountCodeValue = normalizeAccountCode($accountCodeRaw);
            if ($accountCodeValue === '' && !empty($defaultAccountCode)) {
                $accountCodeValue = normalizeAccountCode($defaultAccountCode);
            }
            if (!in_array($accountCodeValue, ['10.1', '10.2', '41.1', '43', '43_mod'], true)) {
                $accountCodeValue = '';
            }
            $accountCodeValue = $accountCodeValue !== '' ? $accountCodeValue : null;

            if ($sku === '') {
                $prefix = 'PROD-';
                if ($accountCodeValue === '10.1') $prefix = 'ING-';
                if ($accountCodeValue === '10.2') $prefix = 'SEM-';
                if ($accountCodeValue === '41.1') $prefix = 'PROD-';
                if ($accountCodeValue === '43') $prefix = 'MENU-';
                if ($accountCodeValue === '43_mod') $prefix = 'MOD-';

                if (!isset($skuPrefixMax[$prefix])) {
                    $max = 0;
                    try {
                        $skuCheckStmt->execute([$prefix . '%']);
                        $rowsSku = $skuCheckStmt->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($rowsSku as $rSku) {
                            $val = (string)($rSku['sku'] ?? '');
                            if (stripos($val, $prefix) !== 0) continue;
                            $num = intval(preg_replace('/\D+/', '', substr($val, strlen($prefix))));
                            if ($num > $max) $max = $num;
                        }
                    } catch (Exception $e) {
                        $max = 0;
                    }
                    $skuPrefixMax[$prefix] = $max;
                }
                $skuPrefixMax[$prefix] += 1;
                $sku = $prefix . str_pad((string)$skuPrefixMax[$prefix], 3, '0', STR_PAD_LEFT);
            }

            $purchasePriceDecimal = null;
            $salePriceDecimal = null;
            if ($purchasePriceRaw !== '') {
                $purchasePriceRaw = str_replace(',', '.', $purchasePriceRaw);
                $purchasePriceDecimal = floatval($purchasePriceRaw);
                if ($purchasePriceDecimal <= 0) $purchasePriceDecimal = null;
            }
            if ($salePriceRaw !== '') {
                $salePriceRaw = str_replace(',', '.', $salePriceRaw);
                $salePriceDecimal = floatval($salePriceRaw);
                if ($salePriceDecimal <= 0) $salePriceDecimal = null;
            }

            $priceDecimal = null;
            if ($priceRaw !== '') {
                $priceRaw = str_replace(',', '.', $priceRaw);
                $priceDecimal = floatval($priceRaw);
                if ($priceDecimal < 0) $priceDecimal = null;
            }
            if ($salePriceDecimal !== null) {
                $priceDecimal = $salePriceDecimal;
            }
            if ($priceDecimal === null) {
                $priceDecimal = 0;
            }
            if (($accountCodeValue === '41.1' || $accountCodeValue === '43') && $priceDecimal <= 0) {
                $errors++;
                $errorMessages[] = "Строка $lineNumber: некорректная цена ($priceRaw)";
                continue;
            }

            $costDecimal = null;
            if (!empty($cost)) {
                $cost = str_replace(',', '.', $cost);
                $costDecimal = floatval($cost);
                if ($costDecimal <= 0) {
                    $costDecimal = null;
                }
            }
            if ($costDecimal === null && $purchasePriceDecimal !== null) {
                $costDecimal = $purchasePriceDecimal;
            }

            $weightValue = !empty($weight) ? $weight : null;

            $caloriesValue = null;
            if (!empty($calories)) {
                $caloriesValue = intval($calories);
                if ($caloriesValue <= 0) {
                    $caloriesValue = null;
                }
            }

            $availableBool = 1;
            if (!empty($available)) {
                $availableLower = mb_strtolower($available);
                if (in_array($availableLower, ['0', 'false', 'нет', 'no', 'н'])) {
                    $availableBool = 0;
                }
            }
            if ($importHidden) {
                $availableBool = 0;
            }

            $visibleOnSiteInsert = 1;
            if ($csvVisibleOnSite !== null) {
                $visibleOnSiteInsert = intval($csvVisibleOnSite);
            } else {
                if ($accountCodeValue === '10.1' || $accountCodeValue === '41.1') {
                    $visibleOnSiteInsert = 0;
                } elseif ($accountCodeValue === '43' || $accountCodeValue === '43_mod') {
                    $visibleOnSiteInsert = 1;
                } elseif ($displayOnly === 1) {
                    $visibleOnSiteInsert = 1;
                } else {
                    $visibleOnSiteInsert = 1;
                }
            }
            if ($importHidden) {
                $visibleOnSiteInsert = 0;
            }

            $variantSizeLabel = '';
            $variantDiameter = null;
            if ($csvParametersRaw !== '') {
                $parts = array_values(array_filter(array_map('trim', explode('|', $csvParametersRaw)), function($v) { return $v !== ''; }));
                if (!empty($parts)) {
                    $pName = mb_strtolower((string)($parts[0] ?? ''), 'UTF-8');
                    if ($pName !== '' && (mb_strpos($pName, 'размер') !== false || mb_strpos($pName, 'size') !== false || mb_strpos($pName, 'диаметр') !== false)) {
                        $pv = (string)($parts[1] ?? '');
                        if ($pv === '' && isset($parts[3])) $pv = (string)$parts[3];
                        $pv = trim((string)$pv);
                        if ($pv !== '') {
                            if (preg_match('/(\d{2})/u', $pv, $m)) {
                                $d = intval($m[1]);
                                if ($d > 0) $variantDiameter = $d;
                            }
                            if (preg_match('/^\d+$/u', $pv)) {
                                $variantSizeLabel = $pv . ' см';
                            } else {
                                $variantSizeLabel = preg_replace('/\s*(см|cm)\s*$/iu', ' см', $pv);
                                $variantSizeLabel = preg_replace('/\s+/u', ' ', $variantSizeLabel);
                            }
                        }
                    }
                }
            }
            if ($variantSizeLabel === '' && $variantParamRaw !== '') {
                $variantSizeLabel = trim((string)$variantParamRaw);
            }
            if ($variantDiameter === null && $diameterRaw !== '') {
                if (preg_match('/(\d{2})/u', $diameterRaw, $m)) {
                    $d = intval($m[1]);
                    if ($d > 0) $variantDiameter = $d;
                }
            }

            $supplierCodeValue = null;
            $contractNumberValue = null;
            $paymentTermDaysValue = null;
            if ($supplierRaw !== '') {
                $sSlug = generateSlug($supplierRaw);
                $supplierCodeValue = $sSlug !== '' ? ('SUP-' . strtoupper(substr(md5($sSlug), 0, 6))) : null;
                if ($supplierCodeValue) {
                    try {
                        $supplierUpsertStmt->execute([$supplierCodeValue, $supplierRaw]);
                    } catch (Exception $e) {
                        // ignore
                    }
                }
            }
            if ($contractRaw !== '') {
                $parts = array_map('trim', explode('/', $contractRaw, 2));
                $contractNumberValue = $parts[0] !== '' ? $parts[0] : null;
                if (isset($parts[1]) && $parts[1] !== '') {
                    $paymentTermDaysValue = intval($parts[1]);
                    if ($paymentTermDaysValue <= 0) $paymentTermDaysValue = null;
                }
                if ($supplierCodeValue && $contractNumberValue) {
                    try {
                        $contractUpsertStmt->execute([$supplierCodeValue, $contractNumberValue, $paymentTermDaysValue]);
                    } catch (Exception $e) {
                        // ignore
                    }
                }
            }

            $stockQtyValue = null;
            if ($stockQtyRaw !== '') {
                $stockQtyRaw = str_replace(',', '.', $stockQtyRaw);
                $stockQtyValue = floatval($stockQtyRaw);
            }
            $unitValue = $unitRaw !== '' ? $unitRaw : null;

            $ingredientsValue = null;
            if ($ingredientsRaw !== '') {
                $ingredientsItems = [];
                $entries = preg_split('/[;\n]+/u', $ingredientsRaw);
                foreach ($entries as $entry) {
                    $entry = trim($entry);
                    if ($entry === '') continue;
                    $pair = array_map('trim', explode(':', $entry, 2));
                    $iSku = $pair[0] ?? '';
                    $iQtyRaw = $pair[1] ?? '';
                    if ($iSku === '' || $iQtyRaw === '') continue;
                    $iQtyRaw = str_replace(',', '.', $iQtyRaw);
                    $iQty = floatval($iQtyRaw);
                    if ($iQty <= 0) continue;
                    $ingredientsItems[] = ['sku' => $iSku, 'qty' => $iQty, 'unit' => $unitValue];
                }
                if (!empty($ingredientsItems)) {
                    $ingredientsValue = json_encode($ingredientsItems, JSON_UNESCAPED_UNICODE);
                }
            }

            $groupIdValue = null;
            if ($groupRaw !== '') {
                if (preg_match('/^\d+$/', $groupRaw)) {
                    $groupIdValue = intval($groupRaw);
                } else {
                    $segments = array_values(array_filter(array_map('trim', preg_split('/[\/\\>]+/u', $groupRaw)), function($v) { return $v !== ''; }));
                    if (count($segments) > 6) {
                        $segments = array_slice($segments, 0, 6);
                    }
                    $p = null;
                    $last = null;
                    foreach ($segments as $seg) {
                        $productGroupFindStmt->execute([$p, $seg]);
                        $foundG = $productGroupFindStmt->fetch(PDO::FETCH_ASSOC);
                        if ($foundG && isset($foundG['id'])) {
                            $last = intval($foundG['id']);
                        } else {
                            $slug = generateSlug($seg);
                            try {
                                $productGroupInsertStmt->execute([$seg, $slug, $p]);
                                $last = intval($pdo->lastInsertId());
                            } catch (Exception $e) {
                                $fallbackStmt = $pdo->prepare("SELECT id FROM product_groups WHERE name = ? LIMIT 1");
                                $fallbackStmt->execute([$seg]);
                                $fr = $fallbackStmt->fetch(PDO::FETCH_ASSOC);
                                $last = $fr && isset($fr['id']) ? intval($fr['id']) : null;
                            }
                        }
                        $p = $last;
                    }
                    $groupIdValue = $last;
                }
            }

            $shouldUpdate = false;
            $existingProductId = null;
            $existingMarketing = null;
            if ($updateExisting && $skuProvided && $sku !== '') {
                $findExistingBySkuStmt->execute([$sku]);
                $existingMarketing = $findExistingBySkuStmt->fetch(PDO::FETCH_ASSOC);
                if ($existingMarketing && isset($existingMarketing['id'])) {
                    $shouldUpdate = true;
                    $existingProductId = intval($existingMarketing['id']);
                }
            }
            if ($updateExisting && !$shouldUpdate && !$skuColumnExists) {
                $checkStmt = $pdo->prepare("SELECT id FROM products WHERE name = ? LIMIT 1");
                $checkStmt->execute([$name]);
                $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
                if ($existing) {
                    $shouldUpdate = true;
                    $existingProductId = intval($existing['id']);
                }
            }

            $productId = null;
            if ($shouldUpdate && $updateStmt) {
                $localImage = null;
                if ($imageUrl !== '') {
                    $localImage = downloadAndProcessImportedImage($imageUrl, $existingProductId, $logPath);
                }
                $updateStmt->execute([
                    $name,
                    $priceDecimal,
                    $category,
                    $availableBool,
                    $sku ?: null,
                    $weightValue,
                    $caloriesValue,
                    $costDecimal,
                    $purchasePriceDecimal,
                    $salePriceDecimal,
                    $stockQtyValue,
                    $unitValue,
                    $categoryPath,
                    $description !== '' ? $description : null,
                    $localImage,
                    $ingredientsValue,
                    $supplierCodeValue,
                    $contractNumberValue,
                    $paymentTermDaysValue,
                    $accountCodeValue,
                    $groupIdValue,
                    intval($existingProductId)
                ]);
                if ($updateStmt->rowCount() > 0) {
                    $updated++;
                    $productId = $existingProductId;
                } else {
                    $errors++;
                    $errorMessages[] = "Строка $lineNumber: не удалось обновить товар '$name'";
                    continue;
                }
            } else {
                $insertStmt->execute([
                    $name,
                    $description,
                    $priceDecimal,
                    $category,
                    $imageUrl,
                    $availableBool,
                    $sku ?: null,
                    $weightValue,
                    $caloriesValue,
                    $costDecimal,
                    $purchasePriceDecimal,
                    $salePriceDecimal,
                    $stockQtyValue,
                    $unitValue,
                    $categoryPath,
                    $ingredientsValue,
                    $supplierCodeValue,
                    $contractNumberValue,
                    $paymentTermDaysValue,
                    $accountCodeValue !== '' ? $accountCodeValue : null,
                    $groupIdValue,
                    intval($visibleOnSiteInsert)
                ]);
                $productId = $pdo->lastInsertId();
                $created++;

                if ($productId && $imageUrl !== '') {
                    $localImage = downloadAndProcessImportedImage($imageUrl, $productId, $logPath);
                    if ($localImage) {
                        try {
                            $pdo->prepare("UPDATE products SET image_url = ? WHERE id = ?")->execute([$localImage, $productId]);
                        } catch (Exception $e) {
                            // ignore
                        }
                    }
                }
            }

            // --- CSV menu format: link variants to parent using parent_id/id ---
            // parent_id в CSV — это внешний id (из колонки id), а в БД нужен внутренний products.id
            if ($productId) {
                if ($csvKey !== '') {
                    $csvExternalToInternal[$csvKey] = intval($productId);
                }

                $isVariantCsv = ($csvHasParentId && $csvParentIdRaw !== '');
                $parentInternalId = null;
                if ($isVariantCsv) {
                    if (isset($csvExternalToInternal[$csvParentIdRaw])) {
                        $parentInternalId = intval($csvExternalToInternal[$csvParentIdRaw]);
                    }
                }

                $setParts = [];
                $params = [];

                if ($hasParentProductId) {
                    $setParts[] = 'parent_product_id = ?';
                    $params[] = ($isVariantCsv && $parentInternalId !== null) ? intval($parentInternalId) : null;
                }

                $forceVisibility = null;
                if ($csvVisibleOnSite !== null) {
                    $forceVisibility = intval($csvVisibleOnSite);
                } else {
                    if ($accountCodeValue === '10.1' || $accountCodeValue === '41.1') {
                        $forceVisibility = 0;
                    } elseif ($accountCodeValue === '43' || $accountCodeValue === '43_mod') {
                        $forceVisibility = 1;
                    }
                }
                if ($hasVisibleOnSite && $forceVisibility !== null) {
                    $setParts[] = 'visible_on_site = ?';
                    $params[] = intval($forceVisibility);
                }

                if ($hasIsActive) {
                    $setParts[] = 'is_active = 1';
                }

                if ($hasType && $accountCodeValue !== null) {
                    $mappedType = null;
                    if ($accountCodeValue === '10.1') {
                        $mappedType = 'ingredient';
                    } elseif ($accountCodeValue === '41.1') {
                        $mappedType = 'product';
                    } elseif ($accountCodeValue === '43') {
                        $mappedType = 'dish';
                    } elseif ($accountCodeValue === '43_mod') {
                        $mappedType = 'modifier';
                    }
                    if ($mappedType !== null) {
                        $setParts[] = 'type = ?';
                        $params[] = $mappedType;
                    }
                }

                if ($hasSizeLabel && $isVariantCsv && $variantSizeLabel !== '') {
                    $setParts[] = 'size_label = ?';
                    $params[] = $variantSizeLabel;
                }

                if ($hasDiameterCol && $isVariantCsv && $variantDiameter !== null) {
                    $setParts[] = 'diameter = ?';
                    $params[] = intval($variantDiameter);
                }

                if ($hasIsShowcaseParent || $hasDisplayOnlyCol || $hasSkipInventory) {
                    if ($isVariantCsv) {
                        if ($hasIsShowcaseParent) $setParts[] = 'is_showcase_parent = 0';
                        if ($hasDisplayOnlyCol) $setParts[] = 'display_only = 0';
                        if ($hasSkipInventory) $setParts[] = 'skip_inventory = 0';
                    } else {
                        $hasChildren = ($csvKey !== '' && isset($csvParentsWithChildren[$csvKey]));
                        if ($hasChildren || $displayOnly === 1) {
                            if ($hasIsShowcaseParent) $setParts[] = 'is_showcase_parent = 1';
                            if ($hasDisplayOnlyCol) $setParts[] = 'display_only = 1';
                            if ($hasSkipInventory) $setParts[] = 'skip_inventory = 1';
                        }
                    }
                }

                if (!empty($setParts)) {
                    $sql = 'UPDATE products SET ' . implode(', ', $setParts) . ' WHERE id = ?';
                    $params[] = intval($productId);
                    try {
                        $pdo->prepare($sql)->execute($params);
                    } catch (Exception $e) {
                        // ignore
                    }
                }
            }

            if ($displayOnly === 1 || $parentSkuRaw !== '') {
                try {
                    ensureItemsTable($pdo);

                    $itemsColumns = $pdo->query("PRAGMA table_info(items)")->fetchAll(PDO::FETCH_ASSOC);
                    $itemsColumnNames = array_column($itemsColumns, 'name');
                    if (!in_array('display_only', $itemsColumnNames)) {
                        $pdo->exec("ALTER TABLE items ADD COLUMN display_only INTEGER DEFAULT 0");
                    }
                    if (!in_array('parent_id', $itemsColumnNames)) {
                        $pdo->exec("ALTER TABLE items ADD COLUMN parent_id INTEGER");
                        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_items_parent_id ON items(parent_id)");
                    }

                    $parentId = null;
                    if ($parentSkuRaw !== '') {
                        $parentStmt = $pdo->prepare("SELECT id, display_only FROM items WHERE sku = ? LIMIT 1");
                        $parentStmt->execute([$parentSkuRaw]);
                        $parent = $parentStmt->fetch(PDO::FETCH_ASSOC);
                        if ($parent && isset($parent['id'])) {
                            $parentId = intval($parent['id']);
                            $isDisp = intval($parent['display_only'] ?? 0);
                            if ($isDisp !== 1) {
                                try {
                                    $pdo->prepare("UPDATE items SET display_only = 1, parent_id = NULL WHERE id = ?")->execute([$parentId]);
                                } catch (Exception $e) {
                                    // ignore
                                }
                            }
                        } else {
                            $parentName = $name;
                            if ($variantParamRaw !== '') {
                                $parentName = preg_replace('/\s*' . preg_quote($variantParamRaw, '/') . '\s*$/iu', '', $parentName);
                                $parentName = trim((string)$parentName);
                            }
                            if ($parentName === '') {
                                $parentName = $parentSkuRaw;
                            }

                            $createParentStmt = $pdo->prepare("
                                INSERT INTO items (org_id, type, sku, name, description_short, description, attributes, is_visible, status, display_only, parent_id)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ");
                            $createParentStmt->execute([
                                null,
                                'dish',
                                $parentSkuRaw,
                                $parentName,
                                null,
                                null,
                                null,
                                1,
                                'published',
                                1,
                                null
                            ]);
                            $parentId = intval($pdo->lastInsertId());
                        }
                    }

                    if ($parentId !== null && $groupIdValue !== null) {
                        try {
                            $pdo->prepare("UPDATE items SET group_id = ? WHERE id = ?")->execute([$groupIdValue, $parentId]);
                        } catch (Exception $e) {
                            // ignore
                        }
                    }

                    $itemName = $name;
                    if ($parentId !== null && $variantParamRaw !== '') {
                        $parentNameStmt = $pdo->prepare("SELECT name FROM items WHERE id = ?");
                        $parentNameStmt->execute([$parentId]);
                        $parentNameRow = $parentNameStmt->fetch(PDO::FETCH_ASSOC);
                        if ($parentNameRow) {
                            $itemName = $parentNameRow['name'] . ' ' . $variantParamRaw;
                        }
                    }

                    $attributes = [];
                    if ($variantParamRaw !== '') {
                        $attributes['variant_param'] = $variantParamRaw;
                    }
                    if ($diameterRaw !== '') {
                        $attributes['diameter'] = $diameterRaw;
                    }

                    $existingItemId = null;
                    if ($sku !== '') {
                        $itemCheckStmt = $pdo->prepare("SELECT id FROM items WHERE sku = ? LIMIT 1");
                        $itemCheckStmt->execute([$sku]);
                        $existingItem = $itemCheckStmt->fetch(PDO::FETCH_ASSOC);
                        if ($existingItem) {
                            $existingItemId = intval($existingItem['id']);
                        }
                    }

                    if ($existingItemId && $updateExisting) {
                        $itemUpdateStmt = $pdo->prepare("
                            UPDATE items 
                            SET name = ?, description = ?, sku = ?, display_only = ?, parent_id = ?, attributes = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        ");
                        $itemUpdateStmt->execute([
                            $itemName,
                            $description !== '' ? $description : null,
                            $sku ?: null,
                            $displayOnly,
                            $parentId,
                            !empty($attributes) ? json_encode($attributes, JSON_UNESCAPED_UNICODE) : null,
                            $existingItemId
                        ]);
                    } else {
                        $itemInsertStmt = $pdo->prepare("
                            INSERT INTO items (org_id, type, sku, name, description_short, description, attributes, is_visible, status, display_only, parent_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ");
                        $itemInsertStmt->execute([
                            null,
                            'dish',
                            $sku ?: null,
                            $itemName,
                            null,
                            $description !== '' ? $description : null,
                            !empty($attributes) ? json_encode($attributes, JSON_UNESCAPED_UNICODE) : null,
                            1,
                            'published',
                            $displayOnly,
                            $parentId
                        ]);
                    }
                } catch (Exception $e) {
                    $errors++;
                    $errorMessages[] = "Строка $lineNumber: ошибка при создании item: " . $e->getMessage();
                    error_log("Error creating item: " . $e->getMessage());
                }
            }

            if ($productId && $stockQtyValue !== null && $stockQtyValue > 0) {
                $acc = $accountCodeValue !== null ? $accountCodeValue : '';
                if ($acc === '10.1' || $acc === '41.1') {
                    $receiptAccumulator[$productId] = $receiptAccumulator[$productId] ?? [
                        'product_id' => intval($productId),
                        'qty' => 0.0,
                        'unit' => $unitValue ?: 'шт',
                        'purchase_price' => $purchasePriceDecimal !== null ? $purchasePriceDecimal : $costDecimal,
                        'sale_price' => $salePriceDecimal,
                        'account_code' => $acc
                    ];
                    $receiptAccumulator[$productId]['qty'] += floatval($stockQtyValue);
                    if (!$receiptAccumulator[$productId]['purchase_price'] && $purchasePriceDecimal !== null) {
                        $receiptAccumulator[$productId]['purchase_price'] = $purchasePriceDecimal;
                    }
                }
            }

            try {
                $isDish = false;
                $accDish = $accountCodeValue !== null ? (string)$accountCodeValue : '';
                if ($accDish === '43') {
                    $isDish = true;
                }
                if (!$isDish && $productId) {
                    $typeCheck = $pdo->prepare("SELECT type FROM products WHERE id = ? LIMIT 1");
                    $typeCheck->execute([intval($productId)]);
                    $typeRow = $typeCheck->fetch(PDO::FETCH_ASSOC);
                    if ($typeRow && strtolower((string)($typeRow['type'] ?? '')) === 'dish') {
                        $isDish = true;
                    }
                }
                if ($isDish && $productId && $ingredientsValue) {
                    upsertRecipeFromImportedIngredients($pdo, $productId, $name, $ingredientsValue, 1, 'порция', $logPath);
                }
            } catch (Exception $e) {
                // ignore
            }

            if (!empty($categoryPath) && $productId) {
                $segments = array_values(array_filter(array_map('trim', explode('/', $categoryPath)), function($v) { return $v !== ''; }));
                if (count($segments) > 3) {
                    $segments = array_slice($segments, 0, 3);
                }
                $parentId = null;
                $lastId = null;
                $catType = ($accountCodeValue === '10.1' || $accountCodeValue === '41.1') ? 'stock' : 'menu';
                foreach ($segments as $seg) {
                    $categoryFindByParentAndNameStmt->execute([$parentId, $seg]);
                    $found = $categoryFindByParentAndNameStmt->fetch(PDO::FETCH_ASSOC);
                    if ($found && isset($found['id'])) {
                        $lastId = intval($found['id']);
                        $parentId = $lastId;
                        continue;
                    }
                    $slug = generateSlug($seg);
                    if ($slug === '') {
                        break;
                    }
                    $candidateSlug = $slug;
                    $suffix = 1;
                    while (true) {
                        $categoryFindBySlugStmt->execute([$candidateSlug]);
                        $existsSlug = $categoryFindBySlugStmt->fetch(PDO::FETCH_ASSOC);
                        if (!$existsSlug) {
                            break;
                        }
                        $suffix++;
                        $candidateSlug = $slug . '-' . $suffix;
                    }
                    $categoryUpsertStmt->execute([$seg, $candidateSlug, $parentId, $catType]);
                    $lastId = intval($pdo->lastInsertId());
                    $parentId = $lastId;
                }
                if ($lastId) {
                    $categoryInsertStmt->execute([$productId, $lastId]);
                }
            } elseif (!empty($category) && $productId) {
                $categoryCheckStmt->execute([$category, $category]);
                $categoryData = $categoryCheckStmt->fetch(PDO::FETCH_ASSOC);
                if ($categoryData) {
                    $categoryInsertStmt->execute([$productId, $categoryData['id']]);
                }
            }
        } catch (Exception $e) {
            $errors++;
            $errorMessages[] = "Строка $lineNumber: " . $e->getMessage();
            file_put_contents($logPath, date('Y-m-d H:i:s') . " | Ошибка в строке $lineNumber: " . $e->getMessage() . "\n", FILE_APPEND);
        }
    }

    $receiptTxId = null;
    $receiptWarehouseId = null;
    $receiptLinesCount = 0;

    if (!empty($receiptAccumulator)) {
        try {
            $warehouseId = intval($defaultWarehouseId ?: 1);
            if ($warehouseId <= 0) $warehouseId = 1;
            $receiptWarehouseId = $warehouseId;

            $pdo->beginTransaction();

            $txStmt = $pdo->prepare("INSERT INTO inventory_tx (tx_type, doc_number, doc_date, status, warehouse_id, supplier_code, contract_number, payment_term_days, account_code, meta, created_at, updated_at)
                VALUES ('receipt', ?, ?, 'posted', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))");

            $docNumber = 'IMP-' . date('YmdHis');
            $docDate = date('Y-m-d');
            $supplierCode = null;
            if ($defaultSupplierName !== '') {
                $sSlug = generateSlug($defaultSupplierName);
                $supplierCode = $sSlug !== '' ? ('SUP-' . strtoupper(substr(md5($sSlug), 0, 6))) : null;
            }
            $accCodeForTx = $defaultAccountCode !== '' ? $defaultAccountCode : null;
            $txStmt->execute([
                $docNumber,
                $docDate,
                $warehouseId,
                $supplierCode,
                $defaultContractNumber !== '' ? $defaultContractNumber : null,
                $defaultPaymentTermDays > 0 ? intval($defaultPaymentTermDays) : null,
                $accCodeForTx,
                json_encode($receiptMeta, JSON_UNESCAPED_UNICODE)
            ]);
            $txId = intval($pdo->lastInsertId());
            $receiptTxId = $txId;

            $lineStmt = $pdo->prepare("INSERT INTO inventory_tx_lines (tx_id, product_id, qty, unit, purchase_price, sale_price, account_code, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))");

            $receiptLines = [];
            $idx = 0;
            foreach ($receiptAccumulator as $entry) {
                $idx++;
                $receiptLinesCount++;
                $lineStmt->execute([
                    $txId,
                    intval($entry['product_id']),
                    floatval($entry['qty']),
                    $entry['unit'] ?: 'шт',
                    $entry['purchase_price'],
                    $entry['sale_price'],
                    $entry['account_code']
                ]);

                $receiptLines[] = [
                    'product_id' => intval($entry['product_id']),
                    'qty' => floatval($entry['qty']),
                    'unit' => $entry['unit'] ?: 'шт',
                    'purchase_price' => $entry['purchase_price'],
                    'sale_price' => $entry['sale_price'],
                    'account_code' => $entry['account_code'],
                    'batch_number' => 'IMP-' . $txId . '-' . $idx
                ];
            }

            $pdo->commit();

            $receiptDoc = [
                'id' => $txId,
                'status' => 'posted',
                'warehouseId' => $warehouseId,
                'lines' => $receiptLines
            ];
            applyReceiptDocumentToInventoryBalances($pdo, $receiptDoc);
        } catch (Exception $e) {
            try {
                $pdo->rollBack();
            } catch (Exception $e2) {
                // ignore
            }
            $errors++;
            $errorMessages[] = 'Не удалось создать документ прихода: ' . $e->getMessage();
            file_put_contents($logPath, date('Y-m-d H:i:s') . " | Ошибка создания документа прихода: " . $e->getMessage() . "\n", FILE_APPEND);
        }
    }

    return [
        'created' => $created,
        'updated' => $updated,
        'errors' => $errors,
        'errorMessages' => $errorMessages,
        'receipt' => [
            'tx_id' => $receiptTxId,
            'warehouse_id' => $receiptWarehouseId,
            'lines_count' => $receiptLinesCount
        ]
    ];
}

/**
 * Process YML file
 */
function processYMLFile($pdo, $filePath, $updateExisting, $importHidden, $logPath, $defaultAccountCode = '', $defaultSupplierName = '', $defaultContractNumber = '', $defaultPaymentTermDays = 0, $defaultWarehouseId = 1, $fieldMappingOverride = null) {
    $created = 0;
    $updated = 0;
    $errors = 0;
    $errorMessages = [];
    $receiptAccumulator = [];
    $receiptMeta = [
        'source' => 'import_products',
        'supplier_name' => $defaultSupplierName,
        'contract_number' => $defaultContractNumber,
        'payment_term_days' => intval($defaultPaymentTermDays)
    ];
    
    // Load XML file
    libxml_use_internal_errors(true);
    $xml = simplexml_load_file($filePath);
    
    if ($xml === false) {
        $xmlErrors = libxml_get_errors();
        $errorMessages[] = 'Ошибка парсинга XML: ' . implode(', ', array_map(function($e) { return $e->message; }, $xmlErrors));
        throw new Exception('Не удалось прочитать YML/XML файл: ' . $errorMessages[0]);
    }
    
    // Find offers
    $offers = $xml->xpath('//offer');
    if (empty($offers)) {
        // Try shop->offers->offer structure
        $offers = $xml->xpath('//shop/offers/offer');
    }
    if (empty($offers)) {
        throw new Exception('Не найдены элементы <offer> в YML файле');
    }

    $mappingBySystem = [];
    if (is_array($fieldMappingOverride) && !empty($fieldMappingOverride)) {
        foreach ($fieldMappingOverride as $k => $v) {
            if ($k === null || $v === null) continue;
            $ks = trim((string)$k);
            $vs = trim((string)$v);
            if ($ks === '' || $vs === '') continue;
            if (preg_match('/^[a-z_]+$/', $ks)) {
                $mappingBySystem[$ks] = $vs;
            } else {
                if (preg_match('/^[a-z_]+$/', $vs)) {
                    $mappingBySystem[$vs] = $ks;
                }
            }
        }
    }

    $readOfferTag = function($offer, $tag) {
        try {
            if (!$offer || !$tag) return '';
            $t = trim((string)$tag);
            if ($t === '') return '';
            // SimpleXML: access as property
            $val = $offer->{$t};
            if ($val === null) return '';
            return trim((string)$val);
        } catch (Exception $e) {
            return '';
        }
    };

    $buildCategoryPathFromId = function($xmlRoot, $catId) {
        try {
            $cid = trim((string)$catId);
            if ($cid === '' || !$xmlRoot) return '';
            $path = [];
            $seen = [];
            $current = $cid;
            for ($i = 0; $i < 10; $i++) {
                if ($current === '' || isset($seen[$current])) break;
                $seen[$current] = true;
                $nodes = $xmlRoot->xpath("//category[@id='{$current}']");
                if (empty($nodes)) break;
                $node = $nodes[0];
                $name = trim((string)$node);
                if ($name !== '') {
                    array_unshift($path, $name);
                }
                $parent = trim((string)($node['parentId'] ?? ''));
                if ($parent === '' || $parent === $current) break;
                $current = $parent;
            }
            if (count($path) > 3) {
                $path = array_slice($path, -3);
            }
            return implode('/', $path);
        } catch (Exception $e) {
            return '';
        }
    };
    
    // Ensure account_code column exists
    try {
        $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_column($columns, 'name');
        if (!in_array('account_code', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN account_code TEXT");
        }
    } catch (Exception $e) {
        // Ignore errors
    }

    $accountCodeValue = !empty($defaultAccountCode) ? $defaultAccountCode : null;

    // Prepare statements
    // Ensure extended columns exist (best-effort)
    try {
        $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_column($columns, 'name');
        $need = ['sku', 'category_path', 'cost', 'purchase_price', 'sale_price', 'stock_qty', 'unit', 'ingredients', 'supplier_code', 'contract_number', 'payment_term_days'];
        foreach ($need as $col) {
            if (!in_array($col, $columnNames)) {
                if (in_array($col, ['cost', 'purchase_price', 'sale_price'], true)) {
                    $pdo->exec("ALTER TABLE products ADD COLUMN {$col} DECIMAL(10,2)");
                } elseif ($col === 'stock_qty') {
                    $pdo->exec("ALTER TABLE products ADD COLUMN stock_qty DECIMAL(10,3)");
                } elseif ($col === 'payment_term_days') {
                    $pdo->exec("ALTER TABLE products ADD COLUMN payment_term_days INTEGER");
                } else {
                    $pdo->exec("ALTER TABLE products ADD COLUMN {$col} TEXT");
                }
            }
        }
    } catch (Exception $e) {
        // ignore
    }

    $insertStmt = $pdo->prepare("
        INSERT INTO products (name, description, price, category, image_url, available, sku, category_path, weight, calories, cost, purchase_price, sale_price, stock_qty, unit, ingredients, supplier_code, contract_number, payment_term_days, account_code, visible_on_site, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    ");
    
    $checkByNameStmt = $pdo->prepare("SELECT id FROM products WHERE name = ? LIMIT 1");
    $checkBySkuStmt = $pdo->prepare("SELECT id FROM products WHERE sku = ? AND sku != '' LIMIT 1");
    $updateStmt = $pdo->prepare("
        UPDATE products
        SET price = ?, category = ?, available = ?, sku = COALESCE(?, sku), category_path = COALESCE(?, category_path), weight = ?, calories = ?, cost = COALESCE(?, cost), purchase_price = COALESCE(?, purchase_price), sale_price = COALESCE(?, sale_price), stock_qty = COALESCE(?, stock_qty), unit = COALESCE(?, unit), ingredients = COALESCE(?, ingredients), supplier_code = COALESCE(?, supplier_code), contract_number = COALESCE(?, contract_number), payment_term_days = COALESCE(?, payment_term_days), account_code = COALESCE(?, account_code), description = COALESCE(?, description), image_url = COALESCE(?, image_url)
        WHERE id = ?
    ");

    // Prepare statements for category mapping + autocreate by path (same rules as CSV)
    $categoryInsertStmt = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
    $categoryUpsertStmt = $pdo->prepare("INSERT INTO categories (name, slug, parent_id, type, show_on_site, show_in_nav, position) VALUES (?, ?, ?, ?, 1, 1, 0)");
    $categoryFindBySlugStmt = $pdo->prepare("SELECT id FROM categories WHERE slug = ? LIMIT 1");
    $categoryFindByParentAndNameStmt = $pdo->prepare("SELECT id, slug FROM categories WHERE parent_id IS ? AND name = ? LIMIT 1");
    
    $offerNumber = 0;
    $maxRows = 50000;
    foreach ($offers as $offer) {
        $offerNumber++;

        if ($offerNumber > $maxRows) {
            $errors++;
            $errorMessages[] = "Превышен лимит строк: максимум {$maxRows} товаров (offers)";
            break;
        }
        
        try {
            // Extract offer data
            $id = (string)($offer['id'] ?? '');

            // Optional field mapping from UI: system -> tag
            $name = '';
            $price = '';
            $description = '';
            $categoryId = '';
            $url = '';
            $picture = '';
            $sku = '';
            $accountCodeRaw = '';
            $purchasePriceRaw = '';
            $salePriceRaw = '';
            $costRaw = '';
            $stockQtyRaw = '';
            $unitRaw = '';
            $supplierRaw = '';
            $contractRaw = '';

            if (!empty($mappingBySystem)) {
                $name = $readOfferTag($offer, $mappingBySystem['name'] ?? '');
                $price = $readOfferTag($offer, $mappingBySystem['price'] ?? '');
                $description = $readOfferTag($offer, $mappingBySystem['description'] ?? '');
                $categoryId = $readOfferTag($offer, $mappingBySystem['categoryId'] ?? ($mappingBySystem['category_id'] ?? ''));
                $url = $readOfferTag($offer, $mappingBySystem['url'] ?? '');
                $picture = $readOfferTag($offer, $mappingBySystem['picture'] ?? '');
                $sku = $readOfferTag($offer, $mappingBySystem['sku'] ?? ($mappingBySystem['vendorcode'] ?? ''));

                $accountCodeRaw = $readOfferTag($offer, $mappingBySystem['account_code'] ?? '');
                $purchasePriceRaw = $readOfferTag($offer, $mappingBySystem['purchase_price'] ?? '');
                $salePriceRaw = $readOfferTag($offer, $mappingBySystem['sale_price'] ?? '');
                $costRaw = $readOfferTag($offer, $mappingBySystem['cost'] ?? ($mappingBySystem['себестоимость'] ?? ''));
                $stockQtyRaw = $readOfferTag($offer, $mappingBySystem['stock_qty'] ?? '');
                $unitRaw = $readOfferTag($offer, $mappingBySystem['unit'] ?? '');
                $supplierRaw = $readOfferTag($offer, $mappingBySystem['supplier'] ?? '');
                $contractRaw = $readOfferTag($offer, $mappingBySystem['contract'] ?? '');
            }

            // Fallback to common YML tags
            if ($name === '') $name = (string)($offer->name ?? $offer->model ?? '');
            if ($price === '') $price = (string)($offer->price ?? '0');
            if ($description === '') $description = (string)($offer->description ?? '');
            if ($categoryId === '') $categoryId = (string)($offer->categoryId ?? '');
            if ($url === '') $url = (string)($offer->url ?? '');
            if ($picture === '') $picture = (string)($offer->picture ?? '');
            if ($sku === '') $sku = (string)($offer->vendorCode ?? '');
            if ($sku === '') $sku = (string)($offer->barcode ?? '');
            if ($sku === '') $sku = $id;

            if ($accountCodeRaw === '') $accountCodeRaw = (string)($offer->account_code ?? '');
            if ($accountCodeRaw === '') $accountCodeRaw = (string)($offer->accountCode ?? '');
            if ($purchasePriceRaw === '') $purchasePriceRaw = (string)($offer->purchase_price ?? $offer->purchasePrice ?? '');
            if ($salePriceRaw === '') $salePriceRaw = (string)($offer->sale_price ?? $offer->salePrice ?? '');
            if ($costRaw === '') $costRaw = (string)($offer->cost ?? '');
            if ($stockQtyRaw === '') $stockQtyRaw = (string)($offer->stock_qty ?? $offer->stockQty ?? $offer->quantity ?? '');
            if ($unitRaw === '') $unitRaw = (string)($offer->unit ?? '');
            if ($supplierRaw === '') $supplierRaw = (string)($offer->supplier ?? $offer->vendor ?? '');
            if ($contractRaw === '') $contractRaw = (string)($offer->contract ?? '');
            
            // Try to get picture from array if exists
            if (empty($picture) && isset($offer->picture) && is_array($offer->picture)) {
                $picture = (string)($offer->picture[0] ?? '');
            }
            
            // Build category path from categories tree
            $categoryPath = '';
            $categoryName = '';
            if (!empty($categoryId)) {
                $categoryPath = $buildCategoryPathFromId($xml, $categoryId);
                if ($categoryPath !== '') {
                    $segs = array_values(array_filter(array_map('trim', explode('/', $categoryPath)), function($v) { return $v !== ''; }));
                    if (!empty($segs)) {
                        $categoryName = (string)end($segs);
                    }
                } else {
                    $categoryNode = $xml->xpath("//category[@id='$categoryId']");
                    if (!empty($categoryNode)) {
                        $categoryName = (string)$categoryNode[0];
                        $categoryPath = trim((string)$categoryName);
                    }
                }
            }
            
            // Validate required fields
            if (empty($name)) {
                $errors++;
                $errorMessages[] = "Offer #$offerNumber (id=$id): отсутствует название";
                continue;
            }
            
            // Convert price
            $price = str_replace(',', '.', $price);
            $priceDecimal = floatval($price);
            if ($priceDecimal <= 0) {
                $errors++;
                $errorMessages[] = "Offer #$offerNumber (id=$id): некорректная цена ($price)";
                continue;
            }

            // account_code: приоритет у offer, иначе берём выбранный в форме
            $accOffer = normalizeAccountCode($accountCodeRaw);
            if ($accOffer === '' && !empty($defaultAccountCode)) {
                $accOffer = normalizeAccountCode($defaultAccountCode);
            }
            if (!in_array($accOffer, ['10.1', '10.2', '41.1', '43', '43_mod'], true)) {
                $accOffer = '';
            }
            $accountCodeValueLocal = $accOffer !== '' ? $accOffer : null;

            // SKU автогенерация (если всё ещё пусто)
            if ($sku === '') {
                $prefix = 'PROD-';
                if ($accountCodeValueLocal === '10.1') $prefix = 'ING-';
                if ($accountCodeValueLocal === '10.2') $prefix = 'SEM-';
                if ($accountCodeValueLocal === '41.1') $prefix = 'PROD-';
                if ($accountCodeValueLocal === '43') $prefix = 'MENU-';
                if ($accountCodeValueLocal === '43_mod') $prefix = 'MOD-';

                if (!isset($skuPrefixMax[$prefix])) {
                    $max = 0;
                    try {
                        $skuCheckStmt->execute([$prefix . '%']);
                        $rowsSku = $skuCheckStmt->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($rowsSku as $rSku) {
                            $val = (string)($rSku['sku'] ?? '');
                            if (stripos($val, $prefix) !== 0) continue;
                            $num = intval(preg_replace('/\D+/', '', substr($val, strlen($prefix))));
                            if ($num > $max) $max = $num;
                        }
                    } catch (Exception $e) {
                        $max = 0;
                    }
                    $skuPrefixMax[$prefix] = $max;
                }
                $skuPrefixMax[$prefix] += 1;
                $sku = $prefix . str_pad((string)$skuPrefixMax[$prefix], 3, '0', STR_PAD_LEFT);
            }

            // Prices: purchase/sale/cost
            $purchasePriceDecimal = null;
            $salePriceDecimal = null;
            $costDecimal = null;
            if ($purchasePriceRaw !== '') {
                $purchasePriceRaw = str_replace(',', '.', $purchasePriceRaw);
                $purchasePriceDecimal = floatval($purchasePriceRaw);
                if ($purchasePriceDecimal <= 0) $purchasePriceDecimal = null;
            }
            if ($salePriceRaw !== '') {
                $salePriceRaw = str_replace(',', '.', $salePriceRaw);
                $salePriceDecimal = floatval($salePriceRaw);
                if ($salePriceDecimal <= 0) $salePriceDecimal = null;
            }
            if ($costRaw !== '') {
                $costRaw = str_replace(',', '.', $costRaw);
                $costDecimal = floatval($costRaw);
                if ($costDecimal <= 0) $costDecimal = null;
            }
            if ($costDecimal === null && $purchasePriceDecimal !== null) {
                $costDecimal = $purchasePriceDecimal;
            }
            if ($salePriceDecimal !== null) {
                $priceDecimal = $salePriceDecimal;
            }

            // stock qty + unit
            $stockQtyValue = null;
            if ($stockQtyRaw !== '') {
                $stockQtyRaw = str_replace(',', '.', $stockQtyRaw);
                $stockQtyValue = floatval($stockQtyRaw);
            }
            $unitValue = $unitRaw !== '' ? $unitRaw : null;

            // Supplier/contract/payment terms
            if ($supplierRaw === '' && $defaultSupplierName !== '') {
                $supplierRaw = $defaultSupplierName;
            }
            if ($contractRaw === '' && $defaultContractNumber !== '') {
                $contractRaw = $defaultContractNumber;
                if (intval($defaultPaymentTermDays) > 0) {
                    $contractRaw = $contractRaw . ' / ' . strval(intval($defaultPaymentTermDays));
                }
            }
            $supplierCodeValue = null;
            $contractNumberValue = null;
            $paymentTermDaysValue = null;
            if ($supplierRaw !== '') {
                $sSlug = generateSlug($supplierRaw);
                $supplierCodeValue = $sSlug !== '' ? ('SUP-' . strtoupper(substr(md5($sSlug), 0, 6))) : null;
                if ($supplierCodeValue) {
                    try {
                        $supplierUpsertStmt->execute([$supplierCodeValue, $supplierRaw]);
                    } catch (Exception $e) {
                        // ignore
                    }
                }
            }
            if ($contractRaw !== '') {
                $parts = array_map('trim', explode('/', $contractRaw, 2));
                $contractNumberValue = $parts[0] !== '' ? $parts[0] : null;
                if (isset($parts[1]) && $parts[1] !== '') {
                    $paymentTermDaysValue = intval($parts[1]);
                    if ($paymentTermDaysValue <= 0) $paymentTermDaysValue = null;
                }
                if ($supplierCodeValue && $contractNumberValue) {
                    try {
                        $contractUpsertStmt->execute([$supplierCodeValue, $contractNumberValue, $paymentTermDaysValue]);
                    } catch (Exception $e) {
                        // ignore
                    }
                }
            }
            
            // Determine availability
            $availableBool = 1;
            $availableAttr = (string)($offer['available'] ?? '');
            if ($availableAttr === 'false' || $availableAttr === '0') {
                $availableBool = 0;
            }
            if ($importHidden) {
                $availableBool = 0;
            }
            
            // Use picture or url as image_url
            $imageUrl = !empty($picture) ? $picture : $url;
            
            // ✅ КРИТИЧНО: Извлекаем weight и calories из YML
            $weight = null;
            $calories = null;

            if (!empty($mappingBySystem)) {
                $w = $readOfferTag($offer, $mappingBySystem['weight'] ?? '');
                $c = $readOfferTag($offer, $mappingBySystem['calories'] ?? '');
                if ($w !== '') $weight = $w;
                if ($c !== '') $calories = is_numeric($c) ? intval($c) : $c;
            }

            // Состав/ТТК (best-effort): JSON массив или строковый формат "SKU:qty; SKU2:qty"
            $ingredientsRaw = '';
            if (!empty($mappingBySystem)) {
                $ingredientsRaw = $readOfferTag($offer, $mappingBySystem['ingredients'] ?? '');
            }
            if ($ingredientsRaw === '') $ingredientsRaw = (string)($offer->ingredients ?? '');
            if ($ingredientsRaw === '') $ingredientsRaw = (string)($offer->recipe ?? '');
            if ($ingredientsRaw === '') $ingredientsRaw = (string)($offer->composition ?? '');
            $ingredientsJson = null;
            if ($ingredientsRaw !== '') {
                $try = json_decode($ingredientsRaw, true);
                if (is_array($try)) {
                    $ingredientsJson = $ingredientsRaw;
                } else {
                    $ingredientsItems = [];
                    $entries = preg_split('/[;\n]+/u', $ingredientsRaw);
                    foreach ($entries as $entry) {
                        $entry = trim($entry);
                        if ($entry === '') continue;
                        $pair = array_map('trim', explode(':', $entry, 2));
                        $iSku = $pair[0] ?? '';
                        $iQtyRaw = $pair[1] ?? '';
                        if ($iSku === '' || $iQtyRaw === '') continue;
                        $iQtyRaw = str_replace(',', '.', $iQtyRaw);
                        $iQty = floatval($iQtyRaw);
                        if ($iQty <= 0) continue;
                        $ingredientsItems[] = ['sku' => $iSku, 'qty' => $iQty, 'unit' => ($unitValue ?: null)];
                    }
                    if (!empty($ingredientsItems)) {
                        $ingredientsJson = json_encode($ingredientsItems, JSON_UNESCAPED_UNICODE);
                    }
                }
            }
            
            // 1. Извлекаем weight напрямую из тега <weight>
            if (isset($offer->weight)) {
                $weightValue = (string)($offer->weight);
                $weight = !empty($weightValue) ? $weightValue : null;
            }
            
            // 2. Извлекаем calories напрямую из тега <calories> (если есть)
            if (isset($offer->calories)) {
                $caloriesValue = (string)($offer->calories);
                $calories = !empty($caloriesValue) && is_numeric($caloriesValue) ? intval($caloriesValue) : null;
            }
            
            // 3. Если не нашли, ищем в параметрах (param) из YML
            if (!$weight || !$calories) {
                if (isset($offer->param)) {
                    $params = is_array($offer->param) ? $offer->param : [$offer->param];
                    foreach ($params as $param) {
                        $paramName = (string)($param['name'] ?? '');
                        $paramValue = (string)($param ?? '');
                        
                        if (empty($paramName) || empty($paramValue)) continue;
                        
                        $paramNameLower = strtolower($paramName);
                        
                        // Извлекаем вес из параметров (если не найден в теге)
                        if (!$weight && (strpos($paramNameLower, 'вес') !== false || $paramNameLower === 'weight')) {
                            $weight = $paramValue;
                        }
                        
                        // Извлекаем калории из параметров (если не найдены в теге)
                        if (!$calories && (strpos($paramNameLower, 'калори') !== false || strpos($paramNameLower, 'calor') !== false)) {
                            $calories = is_numeric($paramValue) ? intval($paramValue) : $paramValue;
                        }
                    }
                }
            }
            
            // Check if product exists
            $existing = null;
            if ($updateExisting && $sku !== '') {
                $checkBySkuStmt->execute([$sku]);
                $existing = $checkBySkuStmt->fetch(PDO::FETCH_ASSOC);
            }
            if (!$existing) {
                $checkByNameStmt->execute([$name]);
                $existing = $checkByNameStmt->fetch(PDO::FETCH_ASSOC);
            }
            
            if ($existing) {
                if (!$updateExisting) {
                    continue;
                }
                // ✅ Обновляем существующий товар с weight и calories
                $productId = $existing['id'];
                $localImage = null;
                if ($imageUrl !== '') {
                    $localImage = downloadAndProcessImportedImage($imageUrl, $productId, $logPath);
                }
                $updateStmt->execute([
                    $priceDecimal,
                    $categoryName,
                    $availableBool,
                    $sku !== '' ? $sku : null,
                    $categoryPath !== '' ? $categoryPath : null,
                    $weight,
                    $calories,
                    $costDecimal,
                    $purchasePriceDecimal,
                    $salePriceDecimal,
                    $stockQtyValue,
                    $unitValue,
                    $ingredientsJson,
                    $supplierCodeValue,
                    $contractNumberValue,
                    $paymentTermDaysValue,
                    $accountCodeValueLocal,
                    $description !== '' ? $description : null,
                    $localImage,
                    $productId
                ]);
                $updated++;

                // Автосоздание/обновление ТТК (recipes)
                try {
                    if ($accountCodeValueLocal === '43' && $ingredientsJson) {
                        upsertRecipeFromImportedIngredients($pdo, $productId, $name, $ingredientsJson, 1, 'порция', $logPath);
                    }
                } catch (Exception $e) {
                    // ignore
                }
            } else {
                // Insert
                $insertStmt->execute([
                    $name,
                    $description,
                    $priceDecimal,
                    $categoryName,
                    $imageUrl,
                    $availableBool,
                    $sku !== '' ? $sku : null,
                    $categoryPath !== '' ? $categoryPath : null,
                    $weight,
                    $calories,
                    $costDecimal,
                    $purchasePriceDecimal,
                    $salePriceDecimal,
                    $stockQtyValue,
                    $unitValue,
                    $ingredientsJson,
                    $supplierCodeValue,
                    $contractNumberValue,
                    $paymentTermDaysValue,
                    $accountCodeValueLocal
                ]);
                $newId = intval($pdo->lastInsertId());
                if ($newId > 0 && $imageUrl !== '') {
                    $localImage = downloadAndProcessImportedImage($imageUrl, $newId, $logPath);
                    if ($localImage) {
                        try {
                            $pdo->prepare("UPDATE products SET image_url = ? WHERE id = ?")->execute([$localImage, $newId]);
                        } catch (Exception $e) {
                            // ignore
                        }
                    }
                }

                // Автосоздание/обновление ТТК (recipes)
                try {
                    if ($newId > 0 && $accountCodeValueLocal === '43' && $ingredientsJson) {
                        upsertRecipeFromImportedIngredients($pdo, $newId, $name, $ingredientsJson, 1, 'порция', $logPath);
                    }
                } catch (Exception $e) {
                    // ignore
                }
                $created++;
            }

            // Accumulate receipt lines for stock items (10.1/41.1)
            $effectiveProductId = isset($productId) && $productId ? intval($productId) : (isset($newId) ? intval($newId) : 0);
            if ($effectiveProductId > 0 && $stockQtyValue !== null && $stockQtyValue > 0) {
                $acc = $accountCodeValueLocal !== null ? $accountCodeValueLocal : '';
                if ($acc === '10.1' || $acc === '41.1') {
                    $receiptAccumulator[$effectiveProductId] = $receiptAccumulator[$effectiveProductId] ?? [
                        'product_id' => intval($effectiveProductId),
                        'qty' => 0.0,
                        'unit' => $unitValue ?: 'шт',
                        'purchase_price' => $purchasePriceDecimal !== null ? $purchasePriceDecimal : $costDecimal,
                        'sale_price' => $salePriceDecimal,
                        'account_code' => $acc
                    ];
                    $receiptAccumulator[$effectiveProductId]['qty'] += floatval($stockQtyValue);
                    if (!$receiptAccumulator[$effectiveProductId]['purchase_price'] && $purchasePriceDecimal !== null) {
                        $receiptAccumulator[$effectiveProductId]['purchase_price'] = $purchasePriceDecimal;
                    }
                }
            }

            // Handle category mapping (many-to-many) + autocreate by path
            $effectiveProductId = isset($productId) && $productId ? intval($productId) : (isset($newId) ? intval($newId) : 0);
            if ($effectiveProductId > 0 && $categoryPath !== '') {
                $segments = array_values(array_filter(array_map('trim', explode('/', $categoryPath)), function($v) { return $v !== ''; }));
                if (count($segments) > 3) {
                    $segments = array_slice($segments, 0, 3);
                }
                $parentId = null;
                $lastId = null;
                $catType = ($accountCodeValueLocal === '10.1' || $accountCodeValueLocal === '41.1') ? 'stock' : 'menu';
                foreach ($segments as $seg) {
                    $categoryFindByParentAndNameStmt->execute([$parentId, $seg]);
                    $found = $categoryFindByParentAndNameStmt->fetch(PDO::FETCH_ASSOC);
                    if ($found && isset($found['id'])) {
                        $lastId = intval($found['id']);
                        $parentId = $lastId;
                        continue;
                    }
                    $slug = generateSlug($seg);
                    if ($slug === '') {
                        break;
                    }
                    $candidateSlug = $slug;
                    $suffix = 1;
                    while (true) {
                        $categoryFindBySlugStmt->execute([$candidateSlug]);
                        $existsSlug = $categoryFindBySlugStmt->fetch(PDO::FETCH_ASSOC);
                        if (!$existsSlug) {
                            break;
                        }
                        $suffix++;
                        $candidateSlug = $slug . '-' . $suffix;
                    }
                    $categoryUpsertStmt->execute([$seg, $candidateSlug, $parentId, $catType]);
                    $lastId = intval($pdo->lastInsertId());
                    $parentId = $lastId;
                }
                if ($lastId) {
                    $categoryInsertStmt->execute([$effectiveProductId, $lastId]);
                }
            }
            
        } catch (Exception $e) {
            $errors++;
            $errorMessages[] = "Offer #$offerNumber: " . $e->getMessage();
            file_put_contents($logPath, date('Y-m-d H:i:s') . " | Ошибка в offer #$offerNumber: " . $e->getMessage() . "\n", FILE_APPEND);
        }
    }

    // Create receipt document for accumulated stock lines
    $receiptTxId = null;
    $receiptWarehouseId = null;
    $receiptLinesCount = 0;
    if (!empty($receiptAccumulator)) {
        try {
            $warehouseId = intval($defaultWarehouseId ?: 1);
            if ($warehouseId <= 0) $warehouseId = 1;
            $receiptWarehouseId = $warehouseId;

            $pdo->beginTransaction();

            $txStmt = $pdo->prepare("INSERT INTO inventory_tx (tx_type, doc_number, doc_date, status, warehouse_id, supplier_code, contract_number, payment_term_days, account_code, meta, created_at, updated_at)
                VALUES ('receipt', ?, ?, 'posted', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))");

            $docNumber = 'IMP-' . date('YmdHis');
            $docDate = date('Y-m-d');
            $supplierCode = null;
            if ($defaultSupplierName !== '') {
                $sSlug = generateSlug($defaultSupplierName);
                $supplierCode = $sSlug !== '' ? ('SUP-' . strtoupper(substr(md5($sSlug), 0, 6))) : null;
            }
            $accCodeForTx = $defaultAccountCode !== '' ? $defaultAccountCode : null;
            $txStmt->execute([
                $docNumber,
                $docDate,
                $warehouseId,
                $supplierCode,
                $defaultContractNumber !== '' ? $defaultContractNumber : null,
                intval($defaultPaymentTermDays) > 0 ? intval($defaultPaymentTermDays) : null,
                $accCodeForTx,
                json_encode($receiptMeta, JSON_UNESCAPED_UNICODE)
            ]);
            $txId = intval($pdo->lastInsertId());
            $receiptTxId = $txId;

            $lineStmt = $pdo->prepare("INSERT INTO inventory_tx_lines (tx_id, product_id, qty, unit, purchase_price, sale_price, account_code, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))");

            $receiptLines = [];
            $idx = 0;
            foreach ($receiptAccumulator as $entry) {
                $idx++;
                $receiptLinesCount++;
                $lineStmt->execute([
                    $txId,
                    intval($entry['product_id']),
                    floatval($entry['qty']),
                    $entry['unit'] ?: 'шт',
                    $entry['purchase_price'],
                    $entry['sale_price'],
                    $entry['account_code']
                ]);
                $receiptLines[] = [
                    'product_id' => intval($entry['product_id']),
                    'qty' => floatval($entry['qty']),
                    'unit' => $entry['unit'] ?: 'шт',
                    'purchase_price' => $entry['purchase_price'],
                    'sale_price' => $entry['sale_price'],
                    'account_code' => $entry['account_code'],
                    'batch_number' => 'IMP-' . $txId . '-' . $idx
                ];
            }

            $pdo->commit();

            $receiptDoc = [
                'id' => $txId,
                'status' => 'posted',
                'warehouseId' => $warehouseId,
                'lines' => $receiptLines
            ];
            applyReceiptDocumentToInventoryBalances($pdo, $receiptDoc);
        } catch (Exception $e) {
            try { $pdo->rollBack(); } catch (Exception $e2) {}
            $errors++;
            $errorMessages[] = 'Не удалось создать документ прихода: ' . $e->getMessage();
            file_put_contents($logPath, date('Y-m-d H:i:s') . " | Ошибка создания документа прихода: " . $e->getMessage() . "\n", FILE_APPEND);
        }
    }
    
    return [
        'created' => $created,
        'updated' => $updated,
        'errors' => $errors,
        'errorMessages' => $errorMessages,
        'receipt' => [
            'tx_id' => $receiptTxId,
            'warehouse_id' => $receiptWarehouseId,
            'lines_count' => $receiptLinesCount
        ]
    ];
}

/**
 * Import products from local products-data.json file into database
 */
function handleImportFromJSON($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    try {
        // Path to products-data.json
        $jsonPath = __DIR__ . '/../products-data.json';
        
        if (!file_exists($jsonPath)) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'File not found',
                'message' => 'Файл products-data.json не найден'
            ]);
            return;
        }
        
        // Read JSON file
        $jsonContent = file_get_contents($jsonPath);
        $products = json_decode($jsonContent, true);
        
        if (!is_array($products)) {
            throw new Exception('Некорректный формат JSON файла');
        }
        
        $created = 0;
        $updated = 0;
        $errors = 0;
        $errorMessages = [];
        
        // Prepare statements
        $checkStmt = $pdo->prepare("SELECT id FROM products WHERE name = ? OR sku = ?");
        $insertStmt = $pdo->prepare("
            INSERT INTO products 
            (name, description, price, category, sku, image_url, weight, calories, visible_on_site, available, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ");
        
        foreach ($products as $index => $product) {
            try {
                // Extract product data
                $name = $product['name'] ?? '';
                $description = $product['description'] ?? $product['short_description'] ?? '';
                $price = isset($product['price']) ? floatval($product['price']) : 0;
                $category = $product['category'] ?? '';
                $sku = $product['sku'] ?? $product['id'] ?? '';
                $imageUrl = $product['image'] ?? $product['image_url'] ?? '';
                $weight = $product['weight'] ?? null;
                $calories = isset($product['calories']) ? intval($product['calories']) : null;
                $visible = isset($product['visible_on_site']) ? ($product['visible_on_site'] ? 1 : 0) : 1;
                $available = isset($product['available']) ? ($product['available'] ? 1 : 0) : 1;
                
                // Validate required fields
                if (empty($name)) {
                    $errors++;
                    $errorMessages[] = "Товар #$index: отсутствует название";
                    continue;
                }
                
                // Check if product already exists
                $checkStmt->execute([$name, $sku]);
                $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
                
                if ($existing) {
                    // ✅ Обновляем существующий товар с weight и calories
                    $updateStmt = $pdo->prepare("
                        UPDATE products 
                        SET description = ?, price = ?, category = ?, image_url = ?, 
                            weight = ?, calories = ?, visible_on_site = ?, available = ?
                        WHERE id = ?
                    ");
                    $updateStmt->execute([
                        $description,
                        $price,
                        $category,
                        $imageUrl,
                        $weight,
                        $calories,
                        $visible,
                        $available,
                        $existing['id']
                    ]);
                    $updated++;
                } else {
                    // Insert new product
                    $insertStmt->execute([
                        $name,
                        $description,
                        $price,
                        $category,
                        $sku,
                        $imageUrl,
                        $weight,
                        $calories,
                        $visible,
                        $available
                    ]);
                    $created++;
                }
                
            } catch (Exception $e) {
                $errors++;
                $errorMessages[] = "Товар #$index: " . $e->getMessage();
            }
        }
        
        error_log("Import from JSON completed: created=$created, updated=$updated, errors=$errors");
        
        echo json_encode([
            'success' => true,
            'message' => "Импорт завершен. Создано: $created, Пропущено (уже существует): $updated, Ошибок: $errors",
            'created' => $created,
            'updated' => $updated,
            'errors' => $errors,
            'errorMessages' => array_slice($errorMessages, 0, 10) // First 10 errors
        ]);
        
    } catch (Exception $e) {
        error_log("Import from JSON error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Import failed',
            'message' => $e->getMessage()
        ]);
    }
}

/**
 * Handle products synchronization for website
 * GET /api/products/sync - Get synced products
 * POST /api/products/sync - Save synced products
 */
function handleProductsSync($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Ensure table exists
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS synced_products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_data TEXT NOT NULL,
                synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");
    } catch (Exception $e) {
        error_log("Error creating synced_products table: " . $e->getMessage());
    }
    
    switch ($method) {
        case 'GET':
            try {
                $cols = [];
                try {
                    $cStmt = $pdo->query("PRAGMA table_info(products)");
                    $cRows = $cStmt ? $cStmt->fetchAll(PDO::FETCH_ASSOC) : [];
                    foreach ($cRows as $cr) {
                        if (isset($cr['name'])) $cols[$cr['name']] = true;
                    }
                } catch (Exception $e) {
                    $cols = [];
                }

                $hasParentProductId = isset($cols['parent_product_id']);
                $hasIsShowcaseParent = isset($cols['is_showcase_parent']);
                $hasIsActive = isset($cols['is_active']);
                $hasVisibleOnSite = isset($cols['visible_on_site']);

                $where = [];
                if ($hasVisibleOnSite) {
                    $where[] = "(p.visible_on_site = 1 OR p.visible_on_site IS NULL)";
                }
                if ($hasIsActive) {
                    $where[] = "(p.is_active = 1 OR p.is_active IS NULL)";
                }
                if ($hasParentProductId) {
                    // отдаём только родительские карточки и обычные товары
                    $where[] = "p.parent_product_id IS NULL";
                }

                $whereSql = !empty($where) ? ('WHERE ' . implode(' AND ', $where)) : '';

                // ВАЖНО: Возвращаем товары НАПРЯМУЮ из таблицы products, а не из synced_products
                // Это гарантирует, что удаленные товары не будут восстановлены
                $stmt = $pdo->query("
                    SELECT 
                        p.*,
                        GROUP_CONCAT(pc.category_id) as category_ids
                    FROM products p
                    LEFT JOIN product_category pc ON p.id = pc.product_id
                    $whereSql
                    GROUP BY p.id
                    ORDER BY p.id
                ");
                $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $variantsStmt = null;
                if ($hasParentProductId) {
                    $variantsStmt = $pdo->prepare("
                        SELECT id, name, price, size_label, diameter
                        FROM products
                        WHERE parent_product_id = ?
                    " . ($hasVisibleOnSite ? " AND (visible_on_site = 1 OR visible_on_site IS NULL)" : "") .
                      ($hasIsActive ? " AND (is_active = 1 OR is_active IS NULL)" : "") .
                    " ORDER BY COALESCE(diameter, 0), COALESCE(size_label, ''), name");
                }
                
                // Преобразуем данные в нужный формат
                $formattedProducts = [];
                foreach ($products as $product) {
                    // Обрабатываем category_ids
                    $categoryIds = [];
                    if (!empty($product['category_ids'])) {
                        $categoryIds = array_map('intval', explode(',', $product['category_ids']));
                    }
                    
                    // ✅ КРИТИЧНО: Загружаем модификаторы и вариации из product_data
                    $modifiers = [];
                    $variations = [];
                    $relatedProducts = [];
                    if (!empty($product['product_data'])) {
                        try {
                            $productData = json_decode($product['product_data'], true);
                            if (is_array($productData)) {
                                $modifiers = $productData['modifiers'] ?? [];
                                $variations = $productData['variations'] ?? $productData['variants'] ?? [];
                                $relatedProducts = $productData['related_products'] ?? [];
                            }
                        } catch (Exception $e) {
                            // Игнорируем ошибки парсинга JSON
                        }
                    }

                    $isShowcase = $hasIsShowcaseParent ? (!empty($product['is_showcase_parent']) ? 1 : 0) : 0;

                    // Если вариаций нет в product_data, но это витринный родитель — собираем вариации из дочерних товаров
                    if ((empty($variations) || !is_array($variations)) && $isShowcase && $variantsStmt) {
                        try {
                            $variantsStmt->execute([intval($product['id'])]);
                            $vrows = $variantsStmt->fetchAll(PDO::FETCH_ASSOC);
                            $built = [];
                            foreach ($vrows as $v) {
                                $vid = intval($v['id'] ?? 0);
                                if ($vid <= 0) continue;
                                $vname = (string)($v['name'] ?? '');
                                $vprice = isset($v['price']) ? floatval($v['price']) : null;
                                $sizeLabel = trim((string)($v['size_label'] ?? ''));
                                if ($sizeLabel === '' && isset($v['diameter']) && $v['diameter'] !== null && $v['diameter'] !== '') {
                                    $d = intval($v['diameter']);
                                    if ($d > 0) $sizeLabel = $d . ' см';
                                }
                                $params = [];
                                if ($sizeLabel !== '') {
                                    $params[] = ['name' => 'Размер', 'value' => $sizeLabel];
                                }
                                $built[] = [
                                    'variant_id' => $vid,
                                    'id' => $vid,
                                    'name' => $vname,
                                    'price' => $vprice,
                                    'parameters' => $params
                                ];
                            }
                            $variations = $built;
                        } catch (Exception $e) {
                            // ignore
                        }
                    }
                    
                    $formattedProduct = [
                        'id' => $product['id'],
                        'name' => $product['name'],
                        'description' => $product['description'] ?? '',
                        'price' => floatval($product['price'] ?? 0),
                        'picture' => $product['image_url'] ?? $product['picture'] ?? '',
                        'photo' => $product['image_url'] ?? $product['photo'] ?? '',
                        'image_url' => $product['image_url'] ?? '',
                        'sku' => $product['sku'] ?? '',
                        'category_ids' => $categoryIds,
                        'weight' => $product['weight'] ?? '',
                        'calories' => $product['calories'] ?? '',
                        'ingredients' => $product['ingredients'] ?? '',
                        'allergens' => $product['allergens'] ?? '',
                        'type' => $product['type'] ?? 'product',
                        'is_showcase_parent' => $isShowcase,
                        'parent_product_id' => $hasParentProductId ? ($product['parent_product_id'] ?? null) : null,
                        // ✅ КРИТИЧНО: Добавляем модификаторы и вариации (размеры)
                        'modifiers' => $modifiers,
                        'variations' => $variations,
                        'related_products' => $relatedProducts,
                        'product_data' => $product['product_data'] ?? null // Сохраняем product_data для извлечения вариаций на фронтенде
                    ];
                    
                    $formattedProducts[] = $formattedProduct;
                }
                
                echo json_encode([
                    'success' => true,
                    'data' => $formattedProducts,
                    'synced_at' => date('Y-m-d H:i:s')
                ]);
            } catch (Exception $e) {
                error_log("Error getting products for sync: " . $e->getMessage());
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage()
                ]);
            }
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!isset($input['products'])) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Products array is required'
                    ]);
                    return;
                }
                
                $products = $input['products'];
                if (!is_array($products)) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Products must be an array'
                    ]);
                    return;
                }
                
                // Delete old synced products
                $pdo->exec("DELETE FROM synced_products");
                
                // Insert new synced products
                $productDataJson = json_encode($products);
                $stmt = $pdo->prepare("INSERT INTO synced_products (product_data, synced_at) VALUES (?, datetime('now'))");
                $stmt->execute([$productDataJson]);
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Products synced successfully',
                    'count' => count($products),
                    'synced_at' => date('Y-m-d H:i:s')
                ]);
            } catch (Exception $e) {
                error_log("Error syncing products: " . $e->getMessage());
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage()
                ]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

/**
 * Handle YML export
 * GET /api/products/export/yml
 */
function handleExportYML($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        return;
    }
    
    try {
        // Get all products from database (including hidden ones for export)
        $stmt = $pdo->query("SELECT * FROM products ORDER BY id");
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Устанавливаем заголовки для XML файла
        header('Content-Type: application/xml; charset=utf-8');
        header('Content-Disposition: attachment; filename="dandy_products_' . date('Y-m-d') . '.yml"');
        
        // Generate YML content
        $date = date('Y-m-d H:i:s');
        $yml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
        $yml .= "<yml_catalog date=\"$date\">\n";
        $yml .= "<shop>\n";
        $yml .= "<name>Dandy Pizza & Sushi</name>\n";
        $yml .= "<company>Dandy Vitrine Demo</company>\n";
        $yml .= "<offers>\n";
        
        if (empty($products)) {
            // Возвращаем пустой YML файл вместо ошибки
            $yml .= "</offers>\n";
            $yml .= "</shop>\n";
            $yml .= "</yml_catalog>\n";
            echo $yml;
            exit;
        }
        
        // Загружаем категории для маппинга
        $categoriesStmt = $pdo->query("SELECT id, name, slug FROM categories");
        $categories = $categoriesStmt->fetchAll(PDO::FETCH_ASSOC);
        $categoryMap = [];
        $categoryIdMap = [];
        foreach ($categories as $cat) {
            $categoryMap[$cat['name']] = $cat['id'];
            $categoryIdMap[$cat['id']] = $cat;
        }
        
        // Загружаем связи товаров с категориями
        $productCategoriesStmt = $pdo->query("SELECT product_id, category_id FROM product_category");
        $productCategories = $productCategoriesStmt->fetchAll(PDO::FETCH_ASSOC);
        $productCategoryMap = [];
        foreach ($productCategories as $pc) {
            if (!isset($productCategoryMap[$pc['product_id']])) {
                $productCategoryMap[$pc['product_id']] = [];
            }
            $productCategoryMap[$pc['product_id']][] = $pc['category_id'];
        }
        
        foreach ($products as $product) {
            $id = $product['id'] ?? $product['sku'] ?? uniqid();
            // Обрабатываем visible_on_site (может быть булево, число 0/1, или null)
            $visibleOnSite = $product['visible_on_site'] ?? $product['available'] ?? true;
            $available = ($visibleOnSite === true || $visibleOnSite === 1 || $visibleOnSite === '1') ? 'true' : 'false';
            $name = escapeXml($product['name'] ?? '');
            $price = number_format((float)($product['price'] ?? 0), 2, '.', '');
            
            $yml .= "  <offer id=\"$id\" available=\"$available\">\n";
            $yml .= "    <name>$name</name>\n";
            $yml .= "    <price>$price</price>\n";
            $yml .= "    <currencyId>RUR</currencyId>\n";
            
            // Category - сначала пробуем из product_category, потом из поля category
            $categoryId = null;
            $productId = $product['id'];
            
            // Пробуем найти категории из таблицы product_category
            if (isset($productCategoryMap[$productId]) && !empty($productCategoryMap[$productId])) {
                // Берем первую категорию из списка
                $firstCategoryId = $productCategoryMap[$productId][0];
                if (isset($categoryIdMap[$firstCategoryId])) {
                    $categoryId = $firstCategoryId;
                }
            }
            
            // Если не нашли через product_category, пробуем поле category
            if (!$categoryId && !empty($product['category'])) {
                $categoryName = $product['category'];
                if (isset($categoryMap[$categoryName])) {
                    $categoryId = $categoryMap[$categoryName];
                } else {
                    // Пытаемся найти по slug или использовать название
                    $categoryId = $categoryName;
                }
            }
            
            if ($categoryId) {
                $category = escapeXml($categoryId);
                $yml .= "    <categoryId>$category</categoryId>\n";
            }
            
            // Все категории товара (если их несколько)
            if (isset($productCategoryMap[$productId]) && count($productCategoryMap[$productId]) > 1) {
                $categoryNames = [];
                foreach ($productCategoryMap[$productId] as $catId) {
                    if (isset($categoryIdMap[$catId])) {
                        $categoryNames[] = escapeXml($categoryIdMap[$catId]['name']);
                    }
                }
                if (!empty($categoryNames)) {
                    $yml .= "    <param name=\"Категории\">" . implode(', ', $categoryNames) . "</param>\n";
                }
            }
            
            // Image
            if (!empty($product['image_url'])) {
                $image = escapeXml($product['image_url']);
                $yml .= "    <picture>$image</picture>\n";
            }
            
            // Description (может быть description или short_description)
            $descriptionText = $product['description'] ?? $product['short_description'] ?? '';
            if (!empty($descriptionText)) {
                $description = escapeXml($descriptionText);
                $yml .= "    <description>$description</description>\n";
            }
            
            // Weight
            if (!empty($product['weight'])) {
                $weight = escapeXml($product['weight']);
                $yml .= "    <param name=\"Вес\">$weight</param>\n";
            }
            
            // Calories
            if (!empty($product['calories'])) {
                $calories = escapeXml($product['calories']);
                $yml .= "    <param name=\"Ккал\">$calories</param>\n";
            }
            
            // SKU/Артикул
            if (!empty($product['sku'])) {
                $sku = escapeXml($product['sku']);
                $yml .= "    <vendorCode>$sku</vendorCode>\n";
                $yml .= "    <param name=\"Артикул\">$sku</param>\n";
            }
            
            // Себестоимость (cost)
            if (!empty($product['cost'])) {
                $cost = number_format((float)$product['cost'], 2, '.', '');
                $yml .= "    <param name=\"Себестоимость\">$cost</param>\n";
            }
            
            // Barcode
            if (!empty($product['barcode'])) {
                $barcode = escapeXml($product['barcode']);
                $yml .= "    <barcode>$barcode</barcode>\n";
            }
            
            // Type (product/dish/ingredient)
            $type = $product['type'] ?? 'product';
            $yml .= "    <param name=\"Тип\">$type</param>\n";
            
            // URL товара (если есть slug)
            if (!empty($product['slug'])) {
                $slug = escapeXml($product['slug']);
                $baseUrl = 'https://nemchinovka.dandypizzasushi.com';
                $yml .= "    <url>$baseUrl/product/$slug</url>\n";
            }
            
            $yml .= "  </offer>\n";
        }
        
        $yml .= "</offers>\n";
        $yml .= "</shop>\n";
        $yml .= "</yml_catalog>\n";
        
        header('Content-Length: ' . strlen($yml));
        echo $yml;
        exit;
        
    } catch (Exception $e) {
        error_log("Error exporting YML: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Export error',
            'message' => $e->getMessage()
        ]);
    }
}

/**
 * Handle single category operations (PUT, DELETE)
 */
function handleSingleCategory($pdo, $categoryId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'PUT':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!$input) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
                    return;
                }
                
                // Проверяем существование категории
                $stmt = $pdo->prepare("SELECT id FROM categories WHERE id = ?");
                $stmt->execute([$categoryId]);
                $existing = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$existing) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Category not found']);
                    return;
                }
                
                $updateFields = [];
                $params = [];
                
                if (isset($input['name'])) {
                    $updateFields[] = "name = ?";
                    $params[] = $input['name'];
                }
                if (isset($input['slug'])) {
                    $updateFields[] = "slug = ?";
                    $params[] = $input['slug'];
                }
                if (isset($input['image_url'])) {
                    $updateFields[] = "image_url = ?";
                    $params[] = $input['image_url'];
                }
                if (isset($input['parent_id'])) {
                    // Проверка на циклические связи
                    if ($input['parent_id']) {
                        $parentId = intval($input['parent_id']);
                        // Нельзя сделать категорию родителем самой себя
                        if ($parentId == $categoryId) {
                            http_response_code(400);
                            echo json_encode(['success' => false, 'error' => 'Category cannot be its own parent']);
                            return;
                        }
                        // Проверяем, не является ли родительская категория потомком текущей
                        $checkStmt = $pdo->prepare("SELECT id, parent_id FROM categories WHERE id = ?");
                        $checkStmt->execute([$parentId]);
                        $parent = $checkStmt->fetch(PDO::FETCH_ASSOC);
                        if ($parent && $parent['parent_id'] == $categoryId) {
                            http_response_code(400);
                            echo json_encode(['success' => false, 'error' => 'Cannot create circular reference']);
                            return;
                        }
                    }
                    $updateFields[] = "parent_id = ?";
                    $params[] = $input['parent_id'] ? intval($input['parent_id']) : null;
                }
                if (isset($input['type']) && in_array($input['type'], ['menu', 'stock'])) {
                    $updateFields[] = "type = ?";
                    $params[] = $input['type'];
                }
                if (isset($input['description'])) {
                    $updateFields[] = "description = ?";
                    $params[] = $input['description'];
                }
                if (isset($input['seo_title'])) {
                    $updateFields[] = "seo_title = ?";
                    $params[] = $input['seo_title'];
                }
                if (isset($input['seo_description'])) {
                    $updateFields[] = "seo_description = ?";
                    $params[] = $input['seo_description'];
                }
                if (isset($input['seo_keywords'])) {
                    $updateFields[] = "seo_keywords = ?";
                    $params[] = $input['seo_keywords'];
                }
                // Проверяем наличие колонок перед обновлением
                $columnsCheck = $pdo->query("PRAGMA table_info(categories)");
                $columns = $columnsCheck->fetchAll(PDO::FETCH_ASSOC);
                $columnNames = array_column($columns, 'name');
                
                // Проверяем и добавляем колонку updated_at если её нет
                if (!in_array('updated_at', $columnNames)) {
                    try {
                        $pdo->exec("ALTER TABLE categories ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
                        error_log("Migration: Added 'updated_at' column to categories table in handleSingleCategory");
                        $columnNames[] = 'updated_at';
                    } catch (Exception $e) {
                        error_log("Warning: Could not add updated_at column: " . $e->getMessage());
                    }
                }
                
                if (isset($input['position']) || isset($input['sort_order'])) {
                    if (in_array('position', $columnNames)) {
                        $updateFields[] = "position = ?";
                        $params[] = intval($input['position'] ?? $input['sort_order'] ?? 0);
                    } elseif (in_array('sort_order', $columnNames)) {
                        $updateFields[] = "sort_order = ?";
                        $params[] = intval($input['position'] ?? $input['sort_order'] ?? 0);
                    }
                }
                if (isset($input['show_on_site'])) {
                    $updateFields[] = "show_on_site = ?";
                    $params[] = $input['show_on_site'] ? 1 : 0;
                }
                if (isset($input['show_in_nav'])) {
                    $updateFields[] = "show_in_nav = ?";
                    $params[] = $input['show_in_nav'] ? 1 : 0;
                }
                if (isset($input['show_in_product_card'])) {
                    $updateFields[] = "show_in_product_card = ?";
                    $params[] = $input['show_in_product_card'] ? 1 : 0;
                }
                
                // Обновляем updated_at только если колонка существует
                if (in_array('updated_at', $columnNames)) {
                    $updateFields[] = "updated_at = CURRENT_TIMESTAMP";
                }
                
                if (empty($updateFields)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'No fields to update']);
                    return;
                }
                
                $params[] = $categoryId;
                $sql = "UPDATE categories SET " . implode(', ', $updateFields) . " WHERE id = ?";
                $stmt = $pdo->prepare($sql);
                $result = $stmt->execute($params);
                
                if ($result) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'Category updated successfully'
                    ]);
                } else {
                    throw new Exception('Failed to update category');
                }
            } catch (Exception $e) {
                error_log("Error updating category: " . $e->getMessage());
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage()
                ]);
            }
            break;
            
        case 'DELETE':
            try {
                // Проверяем существование категории
                $stmt = $pdo->prepare("SELECT id, name FROM categories WHERE id = ?");
                $stmt->execute([$categoryId]);
                $category = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$category) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Category not found']);
                    return;
                }
                
                // Проверяем наличие товаров в категории
                $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM product_category WHERE category_id = ?");
                $stmt->execute([$categoryId]);
                $productCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
                
                // Проверяем наличие дочерних категорий
                $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM categories WHERE parent_id = ?");
                $stmt->execute([$categoryId]);
                $childCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
                
                // Если есть товары или дочерние категории, возвращаем информацию
                if ($productCount > 0 || $childCount > 0) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Cannot delete category with products or child categories',
                        'product_count' => $productCount,
                        'child_count' => $childCount,
                        'message' => "Категория содержит $productCount товаров и $childCount подкатегорий. Сначала перенесите их в другую категорию."
                    ]);
                    return;
                }
                
                // Удаляем категорию (связи удалятся автоматически через CASCADE)
                $stmt = $pdo->prepare("DELETE FROM categories WHERE id = ?");
                $result = $stmt->execute([$categoryId]);
                
                if ($result) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'Category deleted successfully',
                        'deleted_id' => $categoryId,
                        'deleted_name' => $category['name']
                    ]);
                } else {
                    throw new Exception('Failed to delete category');
                }
            } catch (Exception $e) {
                error_log("Error deleting category: " . $e->getMessage());
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage()
                ]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

/**
 * Escape XML special characters
 */
function escapeXml($text) {
    if (empty($text)) {
        return '';
    }
    return htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

// ============================================
// Admin State API Handlers
// ============================================

function handleAdminStateHealth() {
    echo json_encode([
        'ok' => true,
        'service' => 'admin-state',
        'status' => 'ready',
        'timestamp' => date('c')
    ]);
}

function handleAdminStateBootstrap() {
    try {
        $state = getAdminState();
        echo json_encode(['ok' => true, 'state' => $state]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleAdminStateKey($key) {
    $method = $_SERVER['REQUEST_METHOD'];
    $sanitizedKey = preg_replace('/[^a-zA-Z0-9_-]/', '', $key);
    
    if ($sanitizedKey !== $key) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Недопустимое имя ключа']);
        return;
    }
    
    try {
        if ($method === 'GET') {
            $data = getAdminStateKey($sanitizedKey);
            echo json_encode(['ok' => true, 'data' => $data]);
        } elseif ($method === 'PUT' || $method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            if (!isset($input['data'])) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Не переданы данные для сохранения']);
                return;
            }
            $saved = setAdminStateKey($sanitizedKey, $input['data']);
            echo json_encode(['ok' => true, 'data' => $saved]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function getAdminState() {
    $storageDir = __DIR__ . '/../storage/admin';
    $stateFile = $storageDir . '/state.json';
    $defaultFile = __DIR__ . '/../config/admin-default-state.json';
    
    // Создаём директорию, если не существует
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0755, true);
    }
    
    // Загружаем дефолтное состояние
    $defaultState = [];
    if (file_exists($defaultFile)) {
        $defaultState = json_decode(file_get_contents($defaultFile), true) ?: [];
    }
    
    // Загружаем сохранённое состояние
    if (file_exists($stateFile)) {
        $savedState = json_decode(file_get_contents($stateFile), true) ?: [];
        // Мержим с дефолтным
        $state = array_merge($defaultState, $savedState);
    } else {
        $state = $defaultState;
        // Сохраняем дефолтное состояние
        file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    
    return $state;
}

function getAdminStateKey($key) {
    $state = getAdminState();
    if (isset($state[$key])) {
        return $state[$key];
    }
    return null;
}

function setAdminStateKey($key, $value) {
    $storageDir = __DIR__ . '/../storage/admin';
    $stateFile = $storageDir . '/state.json';
    
    // Создаём директорию, если не существует
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0755, true);
    }
    
    // Загружаем текущее состояние
    $state = getAdminState();
    
    // Обновляем ключ
    $state[$key] = $value;
    
    // Сохраняем
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return $value;
}

// ============================================
// Inventory API Handlers
// ============================================

function handleInventoryBootstrap() {
    try {
        $state = getInventoryState();
        echo json_encode(['ok' => true, 'state' => $state]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventoryProducts() {
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'GET') {
            $products = getInventoryProducts();
            echo json_encode(['ok' => true, 'data' => $products]);
        } elseif ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $product = createInventoryProduct($input);
            echo json_encode(['ok' => true, 'data' => $product]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventoryProduct($id) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'PATCH' || $method === 'PUT') {
            $input = json_decode(file_get_contents('php://input'), true);
            $product = updateInventoryProduct($id, $input);
            echo json_encode(['ok' => true, 'product' => $product]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventoryStateKey($key) {
    $method = $_SERVER['REQUEST_METHOD'];
    $sanitizedKey = preg_replace('/[^a-zA-Z0-9_-]/', '', $key);
    
    if ($sanitizedKey !== $key) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Недопустимое имя ключа']);
        return;
    }
    
    try {
        if ($method === 'GET') {
            $data = getInventoryStateKey($sanitizedKey);
            echo json_encode(['ok' => true, 'data' => $data]);
        } elseif ($method === 'PUT') {
            $input = json_decode(file_get_contents('php://input'), true);
            if (!isset($input['data'])) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Не переданы данные для сохранения']);
                return;
            }
            $saved = setInventoryStateKey($sanitizedKey, $input['data']);
            echo json_encode(['ok' => true, 'data' => $saved]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventoryMenuPublish() {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $productIds = isset($input['productIds']) && is_array($input['productIds']) ? $input['productIds'] : [];
        
        $result = publishInventoryMenu($productIds);
        echo json_encode(['ok' => true, 'result' => $result]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function getInventoryState() {
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    $defaultFile = __DIR__ . '/../config/inventory-default-state.json';
    
    // Создаём директорию, если не существует
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0755, true);
    }
    
    // Загружаем дефолтное состояние
    $defaultState = [];
    if (file_exists($defaultFile)) {
        $defaultState = json_decode(file_get_contents($defaultFile), true) ?: [];
    }
    
    // Загружаем сохранённое состояние
    if (file_exists($stateFile)) {
        $savedState = json_decode(file_get_contents($stateFile), true) ?: [];
        // Мержим с дефолтным
        $state = array_merge($defaultState, $savedState);
    } else {
        $state = $defaultState;
        // Сохраняем дефолтное состояние
        file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    
    return $state;
}

function getInventoryStateKey($key) {
    $state = getInventoryState();
    if (isset($state[$key])) {
        return $state[$key];
    }
    return null;
}

function setInventoryStateKey($key, $value) {
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    
    // Создаём директорию, если не существует
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0755, true);
    }
    
    // Загружаем текущее состояние
    $state = getInventoryState();
    
    // Обновляем ключ
    $state[$key] = $value;
    
    // Сохраняем
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return $value;
}

function getInventoryProducts() {
    $state = getInventoryState();
    return isset($state['products']) && is_array($state['products']) ? $state['products'] : [];
}

function createInventoryProduct($data) {
    $state = getInventoryState();
    $products = isset($state['products']) && is_array($state['products']) ? $state['products'] : [];
    
    // Генерируем ID
    $newId = 1;
    if (!empty($products)) {
        $ids = array_map(function($p) { return isset($p['id']) ? intval($p['id']) : 0; }, $products);
        $newId = max($ids) + 1;
    }
    
    $product = array_merge([
        'id' => $newId,
        'code' => '',
        'name' => '',
        'type' => 'ingredient',
        'category' => '',
        'baseUnit' => 'шт',
        'isAlcohol' => false,
        'minStock' => 0,
        'currentStock' => 0,
        'price' => 0,
        'salePrice' => 0,
        'description' => '',
        'visible_on_site' => false
    ], $data);
    $product['id'] = $newId;
    
    $products[] = $product;
    $state['products'] = $products;
    
    // Сохраняем
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return $product;
}

function updateInventoryProduct($id, $data) {
    $state = getInventoryState();
    $products = isset($state['products']) && is_array($state['products']) ? $state['products'] : [];
    
    $found = false;
    $updatedProduct = null;
    foreach ($products as &$product) {
        if (isset($product['id']) && (string)$product['id'] === (string)$id) {
            $product = array_merge($product, $data);
            $product['id'] = intval($id); // Сохраняем ID
            $updatedProduct = $product;
            $found = true;
            break;
        }
    }
    
    if (!$found) {
        throw new Exception('Товар не найден');
    }
    
    $state['products'] = $products;
    
    // Сохраняем
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return $updatedProduct;
}

function publishInventoryMenu($productIds = []) {
    $products = getInventoryProducts();
    
    // Фильтруем по ID, если указаны
    if (!empty($productIds) && is_array($productIds)) {
        $idsSet = array_flip(array_map('strval', $productIds));
        $products = array_filter($products, function($p) use ($idsSet) {
            return isset($p['id']) && isset($idsSet[strval($p['id'])]);
        });
    }
    
    // Формируем offers
    $offers = [];
    foreach ($products as $product) {
        if (isset($product['visible_on_site']) && $product['visible_on_site']) {
            $offers[] = [
                'id' => isset($product['id']) ? intval($product['id']) : 0,
                'code' => isset($product['code']) ? $product['code'] : '',
                'name' => isset($product['name']) ? $product['name'] : '',
                'category_name' => isset($product['category']) ? $product['category'] : 'Другое',
                'price' => isset($product['salePrice']) && $product['salePrice'] > 0 ? floatval($product['salePrice']) : (isset($product['price']) ? floatval($product['price']) : 0),
                'description' => isset($product['description']) ? $product['description'] : '',
                'picture' => isset($product['picture']) ? $product['picture'] : (isset($product['image_url']) ? $product['image_url'] : ''),
                'url' => isset($product['url']) ? $product['url'] : '',
                'ingredients_cost' => isset($product['price']) ? floatval($product['price']) : 0,
                'base_unit' => isset($product['baseUnit']) ? $product['baseUnit'] : 'шт'
            ];
        }
    }
    
    // Формируем категории
    $categories = [];
    $categoryNames = array_unique(array_column($offers, 'category_name'));
    foreach ($categoryNames as $index => $name) {
        $categories[] = [
            'id' => $index + 1,
            'name' => $name
        ];
    }
    
    // Формируем payload
    $payload = [
        'generated_from' => 'inventory',
        'updated_at' => date('c'),
        'offers' => array_values($offers),
        'categories' => $categories
    ];
    
    // Сохраняем в menu_data.json
    $menuFile = __DIR__ . '/../menu_data.json';
    file_put_contents($menuFile, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return [
        'count' => count($offers),
        'file' => 'menu_data.json'
    ];
}

// ============================================
// Additional Inventory API Functions
// ============================================

function deleteInventoryProduct($id) {
    $state = getInventoryState();
    $products = isset($state['products']) && is_array($state['products']) ? $state['products'] : [];
    
    $found = false;
    $deletedProduct = null;
    $products = array_filter($products, function($product) use ($id, &$found, &$deletedProduct) {
        if (isset($product['id']) && (string)$product['id'] === (string)$id) {
            $found = true;
            $deletedProduct = $product;
            return false; // Удаляем из массива
        }
        return true;
    });
    
    if (!$found) {
        throw new Exception('Товар не найден');
    }
    
    $state['products'] = array_values($products);
    
    // Сохраняем
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return $deletedProduct;
}

function getInventoryRecipes() {
    $state = getInventoryState();
    return isset($state['recipes']) && is_array($state['recipes']) ? $state['recipes'] : [];
}

function createInventoryRecipe($data) {
    $state = getInventoryState();
    $recipes = isset($state['recipes']) && is_array($state['recipes']) ? $state['recipes'] : [];
    
    // Генерируем ID
    $newId = 1;
    if (!empty($recipes)) {
        $ids = array_map(function($r) { return isset($r['id']) ? intval($r['id']) : 0; }, $recipes);
        $newId = max($ids) + 1;
    }
    
    $recipe = array_merge([
        'id' => $newId,
        'code' => '',
        'dishId' => null,
        'dishName' => '',
        'version' => 'v1.0',
        'yieldOut' => 0,
        'yieldUnit' => 'шт',
        'ingredients' => [],
        'costPrice' => 0,
        'createdAt' => date('c')
    ], $data);
    $recipe['id'] = $newId;
    
    $recipes[] = $recipe;
    $state['recipes'] = $recipes;
    
    // Сохраняем
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return $recipe;
}

function updateInventoryRecipe($id, $data) {
    $state = getInventoryState();
    $recipes = isset($state['recipes']) && is_array($state['recipes']) ? $state['recipes'] : [];
    
    $found = false;
    $updatedRecipe = null;
    foreach ($recipes as &$recipe) {
        if (isset($recipe['id']) && (string)$recipe['id'] === (string)$id) {
            $recipe = array_merge($recipe, $data);
            $recipe['id'] = intval($id);
            $updatedRecipe = $recipe;
            $found = true;
            break;
        }
    }
    
    if (!$found) {
        throw new Exception('Техкарта не найдена');
    }
    
    $state['recipes'] = $recipes;
    
    // Сохраняем
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return $updatedRecipe;
}

function deleteInventoryRecipe($id) {
    $state = getInventoryState();
    $recipes = isset($state['recipes']) && is_array($state['recipes']) ? $state['recipes'] : [];
    
    $found = false;
    $deletedRecipe = null;
    $recipes = array_filter($recipes, function($recipe) use ($id, &$found, &$deletedRecipe) {
        if (isset($recipe['id']) && (string)$recipe['id'] === (string)$id) {
            $found = true;
            $deletedRecipe = $recipe;
            return false;
        }
        return true;
    });
    
    if (!$found) {
        throw new Exception('Техкарта не найдена');
    }
    
    $state['recipes'] = array_values($recipes);
    
    // Сохраняем
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return $deletedRecipe;
}

function getInventoryDocuments($type = null) {
    $state = getInventoryState();
    $documents = isset($state['documents']) && is_array($state['documents']) ? $state['documents'] : [];
    
    if ($type) {
        $documents = array_filter($documents, function($doc) use ($type) {
            return isset($doc['type']) && $doc['type'] === $type;
        });
    }
    
    return array_values($documents);
}

function createInventoryDocument($data) {
    $state = getInventoryState();
    $documents = isset($state['documents']) && is_array($state['documents']) ? $state['documents'] : [];
    
    // Генерируем ID
    $newId = 'doc_' . time() . '_' . mt_rand(1000, 9999);
    
    $document = array_merge([
        'id' => $newId,
        'type' => 'receipt',
        'status' => 'draft',
        'number' => '',
        'date' => date('c'),
        'warehouse' => '',
        'items' => [],
        'total' => 0,
        'createdAt' => date('c'),
        'createdBy' => 'system'
    ], $data);
    $document['id'] = $newId;
    
    $documents[] = $document;
    $state['documents'] = $documents;
    
    // Сохраняем
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return $document;
}

function updateInventoryDocument($id, $data) {
    $state = getInventoryState();
    $documents = isset($state['documents']) && is_array($state['documents']) ? $state['documents'] : [];
    
    $found = false;
    $updatedDocument = null;
    $wasPosted = false;
    $wasDraft = false;
    
    foreach ($documents as &$document) {
        if (isset($document['id']) && (string)$document['id'] === (string)$id) {
            $wasDraft = (isset($document['status']) && $document['status'] === 'draft');
            $wasPosted = (isset($document['status']) && $document['status'] === 'posted');
            
            $document = array_merge($document, $data);
            $updatedDocument = $document;
            $found = true;
            break;
        }
    }
    
    if (!$found) {
        throw new Exception('Документ не найден');
    }
    
    $state['documents'] = $documents;
    
    // Сохраняем
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    // Отправляем событие при проведении документа
    if (isset($updatedDocument['status']) && $updatedDocument['status'] === 'posted' && $wasDraft) {
        try {
            $docType = $updatedDocument['docType'] ?? $updatedDocument['type'] ?? 'unknown';
            if ($docType === 'receipt') {
                global $pdo;
                if (isset($pdo)) {
                    applyReceiptDocumentToInventoryBalances($pdo, $updatedDocument);
                }
            }
        } catch (Exception $e) {
            error_log("Failed to apply receipt to balances: " . $e->getMessage());
        }

        try {
            appendInventoryEvent([
                'type' => 'DOCUMENT_POSTED',
                'document_id' => $id,
                'document_type' => $updatedDocument['docType'] ?? $updatedDocument['type'] ?? 'unknown',
                'document_number' => $updatedDocument['docNumber'] ?? $updatedDocument['number'] ?? '',
                'warehouse_id' => $updatedDocument['warehouseId'] ?? $updatedDocument['warehouse'] ?? null,
                'payload' => [
                    'lines' => $updatedDocument['lines'] ?? $updatedDocument['items'] ?? [],
                    'totalAmount' => $updatedDocument['totalAmount'] ?? $updatedDocument['total'] ?? 0
                ]
            ]);
        } catch (Exception $e) {
            error_log("Failed to record DOCUMENT_POSTED event: " . $e->getMessage());
        }
    }
    
    return $updatedDocument;
}

function getInventoryWarehouses() {
    $state = getInventoryState();
    return isset($state['warehouses']) && is_array($state['warehouses']) ? $state['warehouses'] : [];
}

function createInventoryWarehouse($data) {
    $state = getInventoryState();
    $warehouses = isset($state['warehouses']) && is_array($state['warehouses']) ? $state['warehouses'] : [];
    
    // Генерируем ID
    $newId = 1;
    if (!empty($warehouses)) {
        $ids = array_map(function($w) { return isset($w['id']) ? intval($w['id']) : 0; }, $warehouses);
        $newId = max($ids) + 1;
    }
    
    $warehouse = array_merge([
        'id' => $newId,
        'name' => '',
        'code' => '',
        'address' => '',
        'type' => 'main',
        'isActive' => true
    ], $data);
    $warehouse['id'] = $newId;
    
    $warehouses[] = $warehouse;
    $state['warehouses'] = $warehouses;
    
    // Сохраняем
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return $warehouse;
}

function getInventoryStockBalances() {
    global $pdo;
    
    // Получаем остатки из БД
    $dbBalances = [];
    try {
        $stmt = $pdo->query("
            SELECT 
                ib.id,
                ib.product_id,
                ib.warehouse_id,
                ib.quantity,
                ib.unit,
                ib.purchase_price,
                ib.updated_at,
                p.name as product_name,
                p.sku as product_code,
                p.type as product_type
            FROM inventory_balances ib
            LEFT JOIN products p ON ib.product_id = p.id
            ORDER BY ib.updated_at DESC
        ");
        $dbBalances = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Преобразуем в формат, совместимый с inventory-system.js
        $dbBalances = array_map(function($row) {
            return [
                'id' => $row['id'],
                'productId' => intval($row['product_id']),
                'warehouseId' => intval($row['warehouse_id']),
                'quantity' => floatval($row['quantity']),
                'unit' => $row['unit'] ?? 'шт',
                'costPerUnit' => floatval($row['purchase_price'] ?? 0),
                'productName' => $row['product_name'] ?? 'Товар не найден',
                'productCode' => $row['product_code'] ?? '',
                'productType' => $row['product_type'] ?? 'product',
                'updatedAt' => $row['updated_at']
            ];
        }, $dbBalances);
    } catch (Exception $e) {
        error_log("Error loading stock balances from DB: " . $e->getMessage());
        // Продолжаем с данными из state файла
    }
    
    // Получаем остатки из state файла (для обратной совместимости)
    $state = getInventoryState();
    $stateBalances = isset($state['stockBalances']) && is_array($state['stockBalances']) ? $state['stockBalances'] : [];
    
    // Объединяем: приоритет у данных из БД
    $merged = [];
    $seen = [];
    
    // Сначала добавляем данные из БД
    foreach ($dbBalances as $balance) {
        $key = $balance['productId'] . '_' . $balance['warehouseId'];
        $merged[] = $balance;
        $seen[$key] = true;
    }
    
    // Добавляем данные из state, которых нет в БД
    foreach ($stateBalances as $balance) {
        $key = ($balance['productId'] ?? '') . '_' . ($balance['warehouseId'] ?? '');
        if (!isset($seen[$key])) {
            $merged[] = $balance;
        }
    }
    
    return $merged;
}

function updateInventoryStockBalances($balances) {
    $state = getInventoryState();
    $state['stockBalances'] = $balances;
    
    // Сохраняем
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return $balances;
}

function getInventoryAuditLog($limit = 100) {
    $state = getInventoryState();
    $auditLog = isset($state['auditLog']) && is_array($state['auditLog']) ? $state['auditLog'] : [];
    
    // Сортируем по дате (новые первые) и ограничиваем
    usort($auditLog, function($a, $b) {
        $timeA = isset($a['timestamp']) ? strtotime($a['timestamp']) : 0;
        $timeB = isset($b['timestamp']) ? strtotime($b['timestamp']) : 0;
        return $timeB - $timeA;
    });
    
    return array_slice($auditLog, 0, $limit);
}

function appendInventoryAuditLog($entry) {
    $state = getInventoryState();
    $auditLog = isset($state['auditLog']) && is_array($state['auditLog']) ? $state['auditLog'] : [];
    
    $entry['timestamp'] = date('c');
    $entry['id'] = 'audit_' . time() . '_' . mt_rand(1000, 9999);
    
    $auditLog[] = $entry;
    
    // Ограничиваем размер (последние 1000 записей)
    if (count($auditLog) > 1000) {
        $auditLog = array_slice($auditLog, -1000);
    }
    
    $state['auditLog'] = $auditLog;
    
    // Сохраняем
    $storageDir = __DIR__ . '/../storage/inventory';
    $stateFile = $storageDir . '/state.json';
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    return $entry;
}

// ============================================
// Inventory API Handlers (new endpoints)
// ============================================

function handleInventoryRecipes() {
    global $pdo;
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'GET') {
            // Используем handleRecipes для GET запросов
            $stmt = $pdo->query("SELECT * FROM recipes ORDER BY created_at DESC");
            $recipes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Декодируем JSON поля
            foreach ($recipes as &$recipe) {
                if (isset($recipe['ingredients']) && is_string($recipe['ingredients'])) {
                    $recipe['ingredients'] = json_decode($recipe['ingredients'], true) ?: [];
                }
            }
            
            echo json_encode(['ok' => true, 'success' => true, 'data' => $recipes]);
        } elseif ($method === 'POST') {
            requireAdminAccessIfConfigured($pdo);
            // Используем handleRecipes для POST запросов
            $input = json_decode(file_get_contents('php://input'), true);

            try {
                $pdo->exec("ALTER TABLE recipes ADD COLUMN markup DECIMAL(10,2) DEFAULT 0");
            } catch (Exception $e) {
                // Колонка уже существует
            }
            
            // Рассчитываем себестоимость
            $cost = calculateRecipeCostFromIngredients($pdo, $input['ingredients'] ?? [], $input['loss_percentage'] ?? 0, $input['markup'] ?? 0);
            
            // Сохраняем техкарту
            $stmt = $pdo->prepare("INSERT INTO recipes (name, description, category_id, output_quantity, output_unit, cooking_time, loss_percentage, cooking_instructions, ingredients, cost, is_active, markup) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $input['name'],
                $input['description'] ?? null,
                $input['category_id'] ?? null,
                $input['output_quantity'],
                $input['output_unit'],
                $input['cooking_time'] ?? null,
                $input['loss_percentage'] ?? 0,
                $input['cooking_instructions'] ?? null,
                json_encode($input['ingredients'] ?? []),
                $cost,
                $input['is_active'] !== false ? 1 : 0,
                $input['markup'] ?? 0
            ]);
            
            $recipeId = $pdo->lastInsertId();
            
            // Создаем или обновляем товар типа "dish" с автоматической себестоимостью
            $productId = createOrUpdateDishFromRecipe($pdo, $recipeId, $input, $cost);
            
            // Обновляем техкарту с product_id
            if ($productId) {
                try {
                    $pdo->exec("ALTER TABLE recipes ADD COLUMN product_id INTEGER");
                } catch (Exception $e) {
                    // Колонка уже существует
                }
                $updateStmt = $pdo->prepare("UPDATE recipes SET product_id = ? WHERE id = ?");
                $updateStmt->execute([$productId, $recipeId]);
            }
            
            // Получаем созданную техкарту
            $stmt = $pdo->prepare("SELECT * FROM recipes WHERE id = ?");
            $stmt->execute([$recipeId]);
            $recipe = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($recipe && isset($recipe['ingredients']) && is_string($recipe['ingredients'])) {
                $recipe['ingredients'] = json_decode($recipe['ingredients'], true) ?: [];
            }
            
            echo json_encode(['ok' => true, 'success' => true, 'data' => $recipe, 'id' => $recipeId, 'product_id' => $productId, 'cost' => $cost]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        error_log("Error in handleInventoryRecipes: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventoryRecipe($id) {
    global $pdo;
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'GET') {
            $stmt = $pdo->prepare("SELECT * FROM recipes WHERE id = ?");
            $stmt->execute([$id]);
            $recipe = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($recipe) {
                if (isset($recipe['ingredients']) && is_string($recipe['ingredients'])) {
                    $recipe['ingredients'] = json_decode($recipe['ingredients'], true) ?: [];
                }
                echo json_encode(['ok' => true, 'data' => $recipe]);
            } else {
                http_response_code(404);
                echo json_encode(['ok' => false, 'error' => 'Recipe not found']);
            }
        } elseif ($method === 'PATCH' || $method === 'PUT') {
            requireAdminAccessIfConfigured($pdo);
            $input = json_decode(file_get_contents('php://input'), true);

            try {
                $pdo->exec("ALTER TABLE recipes ADD COLUMN markup DECIMAL(10,2) DEFAULT 0");
            } catch (Exception $e) {
                // Колонка уже существует
            }
            
            // Рассчитываем себестоимость
            $cost = calculateRecipeCostFromIngredients($pdo, $input['ingredients'] ?? [], $input['loss_percentage'] ?? 0, $input['markup'] ?? 0);
            
            // Обновляем техкарту
            $stmt = $pdo->prepare("UPDATE recipes SET name = ?, description = ?, category_id = ?, output_quantity = ?, output_unit = ?, cooking_time = ?, loss_percentage = ?, cooking_instructions = ?, ingredients = ?, cost = ?, is_active = ?, markup = ? WHERE id = ?");
            $stmt->execute([
                $input['name'],
                $input['description'] ?? null,
                $input['category_id'] ?? null,
                $input['output_quantity'],
                $input['output_unit'],
                $input['cooking_time'] ?? null,
                $input['loss_percentage'] ?? 0,
                $input['cooking_instructions'] ?? null,
                json_encode($input['ingredients'] ?? []),
                $cost,
                $input['is_active'] !== false ? 1 : 0,
                $input['markup'] ?? 0,
                $id
            ]);
            
            // Обновляем товар с новой себестоимостью
            $recipeStmt = $pdo->prepare("SELECT product_id FROM recipes WHERE id = ?");
            $recipeStmt->execute([$id]);
            $recipe = $recipeStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($recipe && $recipe['product_id']) {
                $updateProductStmt = $pdo->prepare("UPDATE products SET cost = ?, name = ? WHERE id = ?");
                $updateProductStmt->execute([$cost, $input['name'], $recipe['product_id']]);
            } else {
                // Создаем товар если его нет
                $productId = createOrUpdateDishFromRecipe($pdo, $id, $input, $cost);
                if ($productId) {
                    try {
                        $pdo->exec("ALTER TABLE recipes ADD COLUMN product_id INTEGER");
                    } catch (Exception $e) {
                        // Колонка уже существует
                    }
                    $updateStmt = $pdo->prepare("UPDATE recipes SET product_id = ? WHERE id = ?");
                    $updateStmt->execute([$productId, $id]);
                }
            }
            
            // Получаем обновленную техкарту
            $stmt = $pdo->prepare("SELECT * FROM recipes WHERE id = ?");
            $stmt->execute([$id]);
            $updatedRecipe = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($updatedRecipe && isset($updatedRecipe['ingredients']) && is_string($updatedRecipe['ingredients'])) {
                $updatedRecipe['ingredients'] = json_decode($updatedRecipe['ingredients'], true) ?: [];
            }
            
            echo json_encode(['ok' => true, 'data' => $updatedRecipe, 'cost' => $cost]);
        } elseif ($method === 'DELETE') {
            requireAdminAccessIfConfigured($pdo);
            $stmt = $pdo->prepare("DELETE FROM recipes WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['ok' => true, 'success' => true]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        error_log("Error in handleInventoryRecipe: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventoryDocuments($type = null) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'GET') {
            $documents = getInventoryDocuments($type);
            echo json_encode(['ok' => true, 'data' => $documents]);
        } elseif ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $document = createInventoryDocument($input);
            echo json_encode(['ok' => true, 'data' => $document]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

// Wrapper to create a receive (receipt) document via /inventory/receive
function handleInventoryReceive($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    try {
        if ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            if (!is_array($input)) $input = [];
            $input['type'] = 'receipt';
            // By default create document as posted if explicitly requested
            if (!isset($input['status'])) $input['status'] = $input['post'] ? 'posted' : 'draft';
            $document = createInventoryDocument($input);
            echo json_encode(['ok' => true, 'data' => $document]);
            return;
        }
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

// Wrapper to create a writeoff document via /inventory/writeoff
function handleInventoryWriteoff($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    try {
        if ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            if (!is_array($input)) $input = [];
            $input['type'] = 'writeoff';
            if (!isset($input['status'])) $input['status'] = $input['post'] ? 'posted' : 'draft';
            $document = createInventoryDocument($input);
            echo json_encode(['ok' => true, 'data' => $document]);
            return;
        }
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventoryDocument($id) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'GET') {
            $documents = getInventoryDocuments();
            $document = null;
            foreach ($documents as $doc) {
                if (isset($doc['id']) && (string)$doc['id'] === (string)$id) {
                    $document = $doc;
                    break;
                }
            }
            if ($document) {
                echo json_encode(['ok' => true, 'data' => $document]);
            } else {
                http_response_code(404);
                echo json_encode(['ok' => false, 'error' => 'Document not found']);
            }
        } elseif ($method === 'PATCH' || $method === 'PUT') {
            $input = json_decode(file_get_contents('php://input'), true);
            $document = updateInventoryDocument($id, $input);
            echo json_encode(['ok' => true, 'data' => $document]);
        } elseif ($method === 'DELETE') {
            // TODO: Реализовать удаление документа
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Delete not implemented']);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventoryWarehouses() {
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'GET') {
            $warehouses = getInventoryWarehouses();
            echo json_encode(['ok' => true, 'data' => $warehouses]);
        } elseif ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $warehouse = createInventoryWarehouse($input);
            echo json_encode(['ok' => true, 'data' => $warehouse]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventoryWarehouse($id) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'GET') {
            $warehouses = getInventoryWarehouses();
            $warehouse = null;
            foreach ($warehouses as $w) {
                if (isset($w['id']) && (string)$w['id'] === (string)$id) {
                    $warehouse = $w;
                    break;
                }
            }
            if ($warehouse) {
                echo json_encode(['ok' => true, 'data' => $warehouse]);
            } else {
                http_response_code(404);
                echo json_encode(['ok' => false, 'error' => 'Warehouse not found']);
            }
        } elseif ($method === 'PATCH' || $method === 'PUT') {
            $input = json_decode(file_get_contents('php://input'), true);
            $state = getInventoryState();
            $warehouses = isset($state['warehouses']) && is_array($state['warehouses']) ? $state['warehouses'] : [];
            
            $found = false;
            foreach ($warehouses as &$warehouse) {
                if (isset($warehouse['id']) && (string)$warehouse['id'] === (string)$id) {
                    $warehouse = array_merge($warehouse, $input);
                    $found = true;
                    break;
                }
            }
            
            if (!$found) {
                throw new Exception('Склад не найден');
            }
            
            $state['warehouses'] = $warehouses;
            $storageDir = __DIR__ . '/../storage/inventory';
            $stateFile = $storageDir . '/state.json';
            file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            
            echo json_encode(['ok' => true, 'data' => $warehouses[array_search($id, array_column($warehouses, 'id'))]]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventoryMovements() {
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'GET') {
            // Движения можно получить из документов
            $documents = getInventoryDocuments();
            $movements = [];
            foreach ($documents as $doc) {
                if (isset($doc['status']) && $doc['status'] === 'posted' && isset($doc['items'])) {
                    foreach ($doc['items'] as $item) {
                        $movements[] = [
                            'id' => $doc['id'] . '_' . ($item['productId'] ?? ''),
                            'documentId' => $doc['id'],
                            'documentType' => $doc['type'],
                            'productId' => $item['productId'] ?? null,
                            'quantity' => $item['quantity'] ?? 0,
                            'warehouse' => $doc['warehouse'] ?? '',
                            'date' => $doc['date'] ?? date('c'),
                            'direction' => in_array($doc['type'], ['receipt', 'transfer_in']) ? 'in' : 'out'
                        ];
                    }
                }
            }
            echo json_encode(['ok' => true, 'data' => $movements]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventoryStockBalances() {
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'GET') {
            $balances = getInventoryStockBalances();
            echo json_encode(['ok' => true, 'data' => $balances]);
        } elseif ($method === 'PUT' || $method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $balances = isset($input['data']) ? $input['data'] : $input;
            $updated = updateInventoryStockBalances($balances);
            echo json_encode(['ok' => true, 'data' => $updated]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventoryAudit() {
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'GET') {
            $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
            $auditLog = getInventoryAuditLog($limit);
            echo json_encode(['ok' => true, 'data' => $auditLog]);
        } elseif ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $entry = appendInventoryAuditLog($input);
            echo json_encode(['ok' => true, 'data' => $entry]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventorySyncTrigger() {
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $scope = isset($input['scope']) ? $input['scope'] : 'all';
            $targetSystem = isset($input['targetSystem']) ? $input['targetSystem'] : 'catalog';
            
            // TODO: Реализовать реальную синхронизацию
            // Пока возвращаем успешный ответ
            echo json_encode([
                'ok' => true,
                'data' => [
                    'jobId' => 'sync_' . time(),
                    'scope' => $scope,
                    'targetSystem' => $targetSystem,
                    'status' => 'queued',
                    'createdAt' => date('c')
                ]
            ]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleInventorySyncStatus() {
    $method = $_SERVER['REQUEST_METHOD'];
    
    try {
        if ($method === 'GET') {
            $ids = isset($_GET['ids']) ? explode(',', $_GET['ids']) : [];
            
            // TODO: Реализовать реальный статус синхронизации
            // Пока возвращаем заглушку
            $statuses = [];
            foreach ($ids as $id) {
                $statuses[] = [
                    'id' => $id,
                    'lastSync' => date('c'),
                    'state' => 'synced',
                    'errors' => []
                ];
            }
            
            echo json_encode(['ok' => true, 'data' => $statuses]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

// ============================================
// Honest Sign API Handlers
// ============================================

function handleHonestSign($endpoint) {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    
    try {
        // Возвращаем пустые данные для всех endpoints
        // Эти модули пока не реализованы, но не должны вызывать 404
        $defaultResponse = ['ok' => true, 'data' => []];
        
        switch ($endpoint) {
            case 'status':
                $defaultResponse['data'] = [
                    'enabled' => false,
                    'connected' => false,
                    'lastSync' => null,
                    'productsCount' => 0,
                    'marksCount' => 0
                ];
                break;
            case 'products':
                $defaultResponse['data'] = [];
                break;
            case 'marks':
                $defaultResponse['data'] = [];
                break;
            case 'reports':
                $defaultResponse['data'] = [];
                break;
            default:
                $defaultResponse['data'] = [];
        }
        
        echo json_encode($defaultResponse);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

// ============================================
// EGAIS API Handlers
// ============================================

function handleEgais($endpoint) {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    
    try {
        // Возвращаем пустые данные для всех endpoints
        // Эти модули пока не реализованы, но не должны вызывать 404
        $defaultResponse = ['ok' => true, 'data' => []];
        
        switch ($endpoint) {
            case 'status':
                $defaultResponse['data'] = [
                    'enabled' => false,
                    'utmConnected' => false,
                    'lastSync' => null,
                    'reportsCount' => 0,
                    'marksCount' => 0
                ];
                break;
            case 'products/alcohol':
                $defaultResponse['data'] = [];
                break;
            case 'marks':
                $defaultResponse['data'] = [];
                break;
            case 'reports':
                $defaultResponse['data'] = [];
                break;
            default:
                $defaultResponse['data'] = [];
        }
        
        echo json_encode($defaultResponse);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

// ============================================
// Aggregators API Handler
// ============================================

function aggregatorsStorageDir() {
    return __DIR__ . '/../storage/integrations';
}

function aggregatorsDataFile() {
    return aggregatorsStorageDir() . '/aggregators.json';
}

function aggregatorsOrdersFile() {
    return aggregatorsStorageDir() . '/aggregator-orders.jsonl';
}

function aggregatorsDefaultStore() {
    return [
        'aggregators' => [
            'yandex_eda' => [
                'id' => 'yandex_eda',
                'name' => 'Яндекс.Еда',
                'description' => 'Приём заказов и синхронизация меню с платформой Яндекс.Еда',
                'enabled' => false,
                'restaurant_id' => '',
                'api_key' => '',
                'webhook_url' => '',
                'menu_last_sync' => null,
                'orders_today' => 0,
                'revenue_today' => 0,
                'status' => 'not_configured'
            ],
            'delivery_club' => [
                'id' => 'delivery_club',
                'name' => 'Delivery Club',
                'description' => 'Подключение ресторана к Delivery Club и обмен заказами',
                'enabled' => false,
                'restaurant_id' => '',
                'api_key' => '',
                'webhook_url' => '',
                'menu_last_sync' => null,
                'orders_today' => 0,
                'revenue_today' => 0,
                'status' => 'not_configured'
            ],
            'vkusvill' => [
                'id' => 'vkusvill',
                'name' => 'ВкусВилл',
                'description' => 'Заказы в сервисе ВкусВилл и онлайн-витрина',
                'enabled' => false,
                'restaurant_id' => '',
                'api_key' => '',
                'webhook_url' => '',
                'menu_last_sync' => null,
                'orders_today' => 0,
                'revenue_today' => 0,
                'status' => 'not_configured'
            ]
        ]
    ];
}

function aggregatorsEnsureStorage() {
    $dir = aggregatorsStorageDir();
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $dataFile = aggregatorsDataFile();
    if (!file_exists($dataFile)) {
        file_put_contents($dataFile, json_encode(aggregatorsDefaultStore(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    $ordersFile = aggregatorsOrdersFile();
    if (!file_exists($ordersFile)) {
        file_put_contents($ordersFile, "");
    }
}

function aggregatorsLoadStore() {
    aggregatorsEnsureStorage();
    $json = json_decode(file_get_contents(aggregatorsDataFile()), true);
    if (!is_array($json)) {
        $json = aggregatorsDefaultStore();
    }
    if (!isset($json['aggregators']) || !is_array($json['aggregators'])) {
        $json['aggregators'] = [];
    }
    $defaults = aggregatorsDefaultStore();
    foreach ($defaults['aggregators'] as $k => $v) {
        if (!isset($json['aggregators'][$k]) || !is_array($json['aggregators'][$k])) {
            $json['aggregators'][$k] = $v;
        } else {
            $json['aggregators'][$k] = array_merge($v, $json['aggregators'][$k]);
        }
    }
    return $json;
}

function aggregatorsSaveStore($store) {
    aggregatorsEnsureStorage();
    file_put_contents(aggregatorsDataFile(), json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function aggregatorsList() {
    $store = aggregatorsLoadStore();
    return array_values($store['aggregators']);
}

function aggregatorsGet($id) {
    $store = aggregatorsLoadStore();
    return isset($store['aggregators'][$id]) ? $store['aggregators'][$id] : null;
}

function aggregatorsUpdate($id, $changes) {
    $store = aggregatorsLoadStore();
    if (!isset($store['aggregators'][$id])) {
        throw new Exception('Aggregator not found');
    }
    if (!is_array($changes)) $changes = [];
    $store['aggregators'][$id] = array_merge($store['aggregators'][$id], $changes);
    aggregatorsSaveStore($store);
    return $store['aggregators'][$id];
}

function aggregatorsToggle($id, $enabled) {
    return aggregatorsUpdate($id, [
        'enabled' => (bool)$enabled,
        'status' => $enabled ? 'active' : 'configured'
    ]);
}

function aggregatorsRecordSync($id, $payload) {
    $now = date('c');
    $changes = [
        'status' => isset($payload['status']) ? $payload['status'] : 'active'
    ];
    if (!empty($payload['menu'])) {
        $changes['menu_last_sync'] = $now;
    }
    if (isset($payload['orders_today'])) {
        $changes['orders_today'] = (int)$payload['orders_today'];
    }
    if (isset($payload['revenue_today'])) {
        $changes['revenue_today'] = (float)$payload['revenue_today'];
    }
    return aggregatorsUpdate($id, $changes);
}

function aggregatorsAppendOrderEvent($id, $payload) {
    $aggregator = aggregatorsGet($id);
    if (!$aggregator) {
        throw new Exception('Aggregator not found');
    }
    $totalRaw = 0;
    if (isset($payload['total'])) $totalRaw = $payload['total'];
    elseif (isset($payload['amount'])) $totalRaw = $payload['amount'];
    elseif (isset($payload['order_total'])) $totalRaw = $payload['order_total'];
    elseif (isset($payload['price'])) $totalRaw = $payload['price'];
    elseif (isset($payload['sum'])) $totalRaw = $payload['sum'];
    $total = (float)$totalRaw;

    aggregatorsEnsureStorage();
    $event = [
        'id' => 'agg_' . time() . '_' . mt_rand(1000, 9999),
        'aggregator' => $id,
        'createdAt' => date('c'),
        'total' => $total,
        'payload' => $payload
    ];
    file_put_contents(aggregatorsOrdersFile(), json_encode($event, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND);

    $ordersToday = isset($aggregator['orders_today']) ? (int)$aggregator['orders_today'] : 0;
    $revToday = isset($aggregator['revenue_today']) ? (float)$aggregator['revenue_today'] : 0;
    aggregatorsUpdate($id, [
        'orders_today' => $ordersToday + 1,
        'revenue_today' => $revToday + $total,
        'status' => 'active'
    ]);

    return $event;
}

function aggregatorsListEvents($id, $limit = 50) {
    aggregatorsEnsureStorage();
    $file = aggregatorsOrdersFile();
    if (!file_exists($file)) return [];
    $content = file_get_contents($file);
    if (!trim((string)$content)) return [];
    $lines = explode("\n", trim($content));
    $events = [];
    for ($i = count($lines) - 1; $i >= 0 && count($events) < $limit; $i--) {
        $line = trim($lines[$i]);
        if ($line === '') continue;
        $evt = json_decode($line, true);
        if (is_array($evt) && isset($evt['aggregator']) && (string)$evt['aggregator'] === (string)$id) {
            $events[] = $evt;
        }
    }
    return array_reverse($events);
}

function handleAggregators($subpath = '') {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    try {
        $subpath = trim((string)$subpath);

        if ($subpath === '') {
            if ($method === 'GET') {
                echo json_encode(['ok' => true, 'data' => aggregatorsList()]);
                return;
            }
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
            return;
        }

        if (preg_match('/^webhook\/(.+)$/', $subpath, $m)) {
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
                return;
            }
            $id = (string)$m[1];
            $aggregator = aggregatorsGet($id);
            if (!$aggregator) {
                http_response_code(404);
                echo json_encode(['ok' => false, 'error' => 'Aggregator not found']);
                return;
            }

            $token = '';
            if (isset($_SERVER['HTTP_X_API_KEY'])) {
                $token = (string)$_SERVER['HTTP_X_API_KEY'];
            } elseif (isset($_GET['token'])) {
                $token = (string)$_GET['token'];
            }
            if ($token === '' || (string)$token !== (string)($aggregator['api_key'] ?? '')) {
                http_response_code(401);
                echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
                return;
            }
            if (empty($aggregator['enabled'])) {
                http_response_code(409);
                echo json_encode(['ok' => false, 'error' => 'Aggregator disabled']);
                return;
            }

            $body = json_decode(file_get_contents('php://input'), true);
            if (!is_array($body)) $body = [];
            $event = aggregatorsAppendOrderEvent($id, $body);
            echo json_encode(['ok' => true, 'data' => ['received' => true, 'eventId' => $event['id']]]);
            return;
        }

        if (preg_match('/^([^\/]+)\/events$/', $subpath, $m)) {
            if ($method !== 'GET') {
                http_response_code(405);
                echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
                return;
            }
            $id = (string)$m[1];
            $aggregator = aggregatorsGet($id);
            if (!$aggregator) {
                http_response_code(404);
                echo json_encode(['ok' => false, 'error' => 'Aggregator not found']);
                return;
            }
            $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
            if ($limit < 1) $limit = 1;
            if ($limit > 200) $limit = 200;
            $events = aggregatorsListEvents($id, $limit);
            echo json_encode(['ok' => true, 'data' => ['events' => $events]]);
            return;
        }

        if (preg_match('/^([^\/]+)\/toggle$/', $subpath, $m)) {
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
                return;
            }
            $id = (string)$m[1];
            $input = json_decode(file_get_contents('php://input'), true);
            if (!is_array($input)) $input = [];
            $enabled = !empty($input['enabled']);
            $updated = aggregatorsToggle($id, $enabled);
            echo json_encode(['ok' => true, 'data' => $updated]);
            return;
        }

        if (preg_match('/^([^\/]+)\/sync$/', $subpath, $m)) {
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
                return;
            }
            $id = (string)$m[1];
            $input = json_decode(file_get_contents('php://input'), true);
            if (!is_array($input)) $input = [];
            $updated = aggregatorsRecordSync($id, $input);
            echo json_encode(['ok' => true, 'data' => $updated]);
            return;
        }

        if (preg_match('/^([^\/]+)$/', $subpath, $m)) {
            $id = (string)$m[1];
            if ($method === 'GET') {
                $aggregator = aggregatorsGet($id);
                if (!$aggregator) {
                    http_response_code(404);
                    echo json_encode(['ok' => false, 'error' => 'Aggregator not found']);
                    return;
                }
                echo json_encode(['ok' => true, 'data' => $aggregator]);
                return;
            }
            if ($method === 'POST') {
                $input = json_decode(file_get_contents('php://input'), true);
                if (!is_array($input)) $input = [];
                $updated = aggregatorsUpdate($id, $input);
                echo json_encode(['ok' => true, 'data' => $updated]);
                return;
            }
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
            return;
        }

        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Not found']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

// ============================================
// Inventory Events Handler
// ============================================

function handleInventoryEvents() {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    
    try {
        if ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['type'])) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Invalid event data']);
                return;
            }
            
            $event = appendInventoryEvent($input);
            echo json_encode(['ok' => true, 'data' => $event]);
        } elseif ($method === 'GET') {
            $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
            $events = getInventoryEvents($limit);
            echo json_encode(['ok' => true, 'data' => $events]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function appendInventoryEvent($event) {
    $storageDir = __DIR__ . '/../storage/catalog';
    $eventsFile = $storageDir . '/integration-events.jsonl';
    
    // Создаём директорию, если не существует
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0755, true);
    }
    
    $eventData = [
        'id' => 'evt_' . time() . '_' . mt_rand(1000, 9999),
        'timestamp' => date('c'),
    ];
    
    // Добавляем все поля из события
    foreach ($event as $key => $value) {
        $eventData[$key] = $value;
    }
    
    // Записываем в JSONL файл
    file_put_contents($eventsFile, json_encode($eventData, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND);
    
    return $eventData;
}

function requireWebhookTokenIfConfigured() {
    $expected = getenv('POS_WEBHOOK_TOKEN');
    if ($expected === false || trim((string)$expected) === '') {
        return;
    }

    $provided = '';
    if (isset($_SERVER['HTTP_X_WEBHOOK_TOKEN'])) {
        $provided = (string)$_SERVER['HTTP_X_WEBHOOK_TOKEN'];
    } elseif (isset($_GET['token'])) {
        $provided = (string)$_GET['token'];
    }

    if (!hash_equals((string)$expected, (string)$provided)) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
        exit;
    }
}

function handlePosWebhook($pdo, $action) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }

    requireWebhookTokenIfConfigured();

    try {
        $inputRaw = file_get_contents('php://input');
        $input = json_decode($inputRaw, true);
        if (!is_array($input)) {
            $input = [];
        }

        $eventType = null;
        if ($action === 'order-created') $eventType = 'pos_order_created';
        if ($action === 'receipt-created') $eventType = 'pos_receipt_created';
        if ($action === 'refund-created') $eventType = 'pos_refund_created';

        $event = appendInventoryEvent([
            'type' => $eventType,
            'source' => 'pos_webhook',
            'payload' => $input
        ]);

        echo json_encode(['ok' => true, 'data' => $event]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function getInventoryEvents($limit = 50) {
    $storageDir = __DIR__ . '/../storage/catalog';
    $eventsFile = $storageDir . '/integration-events.jsonl';
    
    if (!file_exists($eventsFile)) {
        return [];
    }
    
    $content = file_get_contents($eventsFile);
    if (empty(trim($content))) {
        return [];
    }
    
    $lines = explode("\n", trim($content));
    $events = [];
    
    // Читаем с конца файла (последние события)
    for ($i = count($lines) - 1; $i >= 0 && count($events) < $limit; $i--) {
        $line = trim($lines[$i]);
        if (empty($line)) continue;
        
        try {
            $event = json_decode($line, true);
            if ($event) {
                $events[] = $event;
            }
        } catch (Exception $e) {
            // Пропускаем некорректные строки
        }
    }
    
    return array_reverse($events); // Возвращаем в хронологическом порядке
}

// ============================================
// Integrations API Handlers
// ============================================

function handleIntegrationsSettings() {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $settingsFile = __DIR__ . '/../storage/integrations/settings.json';
    
    try {
        if ($method === 'GET') {
            // Загружаем настройки интеграций
            if (file_exists($settingsFile)) {
                $settings = json_decode(file_get_contents($settingsFile), true);
            } else {
                // Настройки по умолчанию
                $settings = [
                    'onec' => [
                        'enabled' => false,
                        'connectionString' => '',
                        'login' => '',
                        'password' => '',
                        'syncInterval' => 3600,
                        'lastSync' => null
                    ],
                    'rkeeper' => [
                        'enabled' => false,
                        'serverUrl' => '',
                        'apiKey' => '',
                        'syncInterval' => 3600,
                        'lastSync' => null
                    ],
                    'kontur' => [
                        'enabled' => false,
                        'apiUrl' => '',
                        'apiKey' => '',
                        'organizationId' => '',
                        'syncInterval' => 3600,
                        'lastSync' => null
                    ]
                ];
            }
            
            echo json_encode(['ok' => true, 'data' => $settings]);
        } elseif ($method === 'POST' || $method === 'PUT') {
            // Сохраняем настройки интеграций
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['data'])) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Invalid settings data']);
                return;
            }
            
            $settingsDir = dirname($settingsFile);
            if (!is_dir($settingsDir)) {
                mkdir($settingsDir, 0755, true);
            }
            
            file_put_contents($settingsFile, json_encode($input['data'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(['ok' => true, 'data' => $input['data']]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleIntegrationsStatus() {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $settingsFile = __DIR__ . '/../storage/integrations/settings.json';
    
    try {
        if ($method === 'GET') {
            // Загружаем настройки для получения статуса
            $settings = [];
            if (file_exists($settingsFile)) {
                $settings = json_decode(file_get_contents($settingsFile), true);
            }
            
            $status = [
                'onec' => [
                    'enabled' => isset($settings['onec']['enabled']) && $settings['onec']['enabled'],
                    'connected' => false, // TODO: проверка подключения
                    'lastSync' => $settings['onec']['lastSync'] ?? null,
                    'syncStatus' => 'idle'
                ],
                'rkeeper' => [
                    'enabled' => isset($settings['rkeeper']['enabled']) && $settings['rkeeper']['enabled'],
                    'connected' => false, // TODO: проверка подключения
                    'lastSync' => $settings['rkeeper']['lastSync'] ?? null,
                    'syncStatus' => 'idle'
                ],
                'kontur' => [
                    'enabled' => isset($settings['kontur']['enabled']) && $settings['kontur']['enabled'],
                    'connected' => false, // TODO: проверка подключения
                    'lastSync' => $settings['kontur']['lastSync'] ?? null,
                    'syncStatus' => 'idle'
                ]
            ];
            
            echo json_encode(['ok' => true, 'data' => $status]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleIntegrationsTest() {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'POST';
    
    try {
        if ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['integration'])) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Invalid test data']);
                return;
            }
            
            $integration = (string)$input['integration'];
            $settingsFile = __DIR__ . '/../storage/integrations/settings.json';
            $settings = [];
            
            if (file_exists($settingsFile)) {
                $settings = json_decode(file_get_contents($settingsFile), true);
            }

            $integrationData = isset($settings[$integration]) && is_array($settings[$integration]) ? $settings[$integration] : [];
            $enabled = !empty($integrationData['enabled']);
            $config = [];

            if (isset($integrationData['config']) && is_array($integrationData['config'])) {
                $config = $integrationData['config'];
            } else {
                $config = $integrationData;
            }

            $result = [
                'integration' => $integration,
                'timestamp' => date('c'),
                'enabled' => $enabled,
                'configured' => false,
                'connected' => false,
                'http_code' => null,
                'message' => ''
            ];

            if (!$enabled) {
                $result['message'] = 'Integration is disabled';
                echo json_encode(['ok' => true, 'data' => $result]);
                return;
            }

            $get = function($arr, $path, $default = '') {
                if (!is_array($arr)) return $default;
                $parts = explode('.', $path);
                $cur = $arr;
                foreach ($parts as $p) {
                    if (!is_array($cur) || !array_key_exists($p, $cur)) return $default;
                    $cur = $cur[$p];
                }
                return $cur;
            };

            $probe = function($url, $headers = []) {
                $url = (string)$url;
                if ($url === '') {
                    return ['ok' => false, 'http_code' => 0, 'error' => 'empty_url'];
                }
                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, $url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_HEADER, false);
                curl_setopt($ch, CURLOPT_NOBODY, true);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
                if (is_array($headers) && count($headers)) {
                    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                }
                curl_exec($ch);
                $err = curl_error($ch);
                $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                if ($code > 0) {
                    return ['ok' => true, 'http_code' => $code, 'error' => ''];
                }
                return ['ok' => false, 'http_code' => 0, 'error' => $err ?: 'connection_failed'];
            };

            $url = '';
            $headers = [];

            switch ($integration) {
                case 'egais':
                    $result['configured'] = (bool)($get($config, 'fsrar_id') && $get($config, 'inn') && $get($config, 'kpp'));
                    $url = (string)($get($config, 'api_url') ?: 'https://fsrar.gov.ru');
                    break;
                case 'mercury':
                    $result['configured'] = (bool)($get($config, 'api_key') && $get($config, 'login') && $get($config, 'issuer_id'));
                    $url = (string)($get($config, 'api_url') ?: 'https://api.vetrf.ru');
                    break;
                case 'honest_sign':
                    $result['configured'] = (bool)($get($config, 'token') && $get($config, 'participant_inn'));
                    $url = (string)($get($config, 'api_url') ?: 'https://markirovka.crpt.ru');
                    $token = (string)$get($config, 'token');
                    if ($token) {
                        $headers[] = 'Authorization: Bearer ' . $token;
                    }
                    break;
                case 'erp_1c':
                    $result['configured'] = (bool)($get($config, 'base_url') && $get($config, 'username') && $get($config, 'password'));
                    $url = (string)$get($config, 'base_url');
                    break;
                case 'yandex_eda':
                    $result['configured'] = (bool)($get($config, 'client_id') && $get($config, 'secret'));
                    $url = (string)$get($config, 'webhook_url');
                    break;
                case 'delivery_club':
                    $result['configured'] = (bool)($get($config, 'restaurant_id') && $get($config, 'api_key'));
                    $url = (string)$get($config, 'webhook_url');
                    break;
                case 'onec':
                    $result['configured'] = (bool)($get($config, 'connectionString') || $get($config, 'base_url') || $get($config, 'url'));
                    $url = (string)($get($config, 'base_url') ?: $get($config, 'url'));
                    break;
                case 'rkeeper':
                    $result['configured'] = (bool)($get($config, 'serverUrl') || $get($config, 'host'));
                    $url = (string)($get($config, 'serverUrl') ?: $get($config, 'host'));
                    break;
                case 'kontur':
                    $result['configured'] = (bool)($get($config, 'apiKey') || $get($config, 'api_key'));
                    $url = (string)($get($config, 'apiUrl') ?: $get($config, 'api_url'));
                    break;
                default:
                    $result['message'] = 'No test implemented for this integration';
                    echo json_encode(['ok' => true, 'data' => $result]);
                    return;
            }

            if (!$result['configured']) {
                $result['message'] = 'Integration is not configured';
                echo json_encode(['ok' => true, 'data' => $result]);
                return;
            }

            if (!$url) {
                $result['message'] = 'No URL to probe';
                echo json_encode(['ok' => true, 'data' => $result]);
                return;
            }

            $probeResult = $probe($url, $headers);
            $result['connected'] = (bool)$probeResult['ok'];
            $result['http_code'] = $probeResult['http_code'] ?: null;
            $result['message'] = $probeResult['ok'] ? 'Connection probe ok' : ('Connection probe failed: ' . $probeResult['error']);

            echo json_encode(['ok' => true, 'data' => $result]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Handle product groups (GET, POST /api/product-groups)
 */
function handleProductGroups($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            try {
                $stmt = $pdo->query("SELECT * FROM product_groups ORDER BY parent_id, name");
                $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['ok' => true, 'data' => $groups]);
            } catch (Exception $e) {
                error_log("Error fetching product groups: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!isset($input['name']) || empty($input['name'])) {
                    http_response_code(400);
                    echo json_encode(['ok' => false, 'error' => 'name is required']);
                    return;
                }
                
                // Автогенерация slug, если не указан
                if (empty($input['slug']) && !empty($input['name'])) {
                    $input['slug'] = generateSlug($input['name']);
                }
                
                // Проверка уникальности slug
                if (!empty($input['slug'])) {
                    $checkStmt = $pdo->prepare("SELECT id FROM product_groups WHERE slug = ?");
                    $checkStmt->execute([$input['slug']]);
                    if ($checkStmt->fetch()) {
                        http_response_code(400);
                        echo json_encode(['ok' => false, 'error' => 'Group with this slug already exists']);
                        return;
                    }
                }
                
                // Проверка существования parent_id, если указан
                $parentId = null;
                if (!empty($input['parent_id'])) {
                    $parentId = intval($input['parent_id']);
                    if ($parentId > 0) {
                        $checkParentStmt = $pdo->prepare("SELECT id FROM product_groups WHERE id = ?");
                        $checkParentStmt->execute([$parentId]);
                        if (!$checkParentStmt->fetch()) {
                            // Родительская группа не существует, устанавливаем parent_id в null
                            error_log("Warning: parent_id {$parentId} does not exist, setting to null");
                            $parentId = null;
                        }
                    } else {
                        $parentId = null;
                    }
                }
                
                $stmt = $pdo->prepare("
                    INSERT INTO product_groups (name, slug, parent_id, default_unit, default_category_stock, default_account, default_tax_group)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $input['name'],
                    $input['slug'] ?? null,
                    $parentId,
                    $input['default_unit'] ?? null,
                    $input['default_category_stock'] ?? null,
                    $input['default_account'] ?? null,
                    $input['default_tax_group'] ?? null
                ]);
                
                $newId = $pdo->lastInsertId();
                
                // Логируем создание (если таблица существует)
                try {
                    $tableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='group_changes_log'")->fetch();
                    if ($tableCheck) {
                        $columns = $pdo->query("PRAGMA table_info(group_changes_log)")->fetchAll(PDO::FETCH_ASSOC);
                        $columnNames = array_column($columns, 'name');
                        if (in_array('group_id', $columnNames)) {
                            $logStmt = $pdo->prepare("
                                INSERT INTO group_changes_log (group_id, action, user_id, old_data, new_data)
                                VALUES (?, 'create', ?, NULL, ?)
                            ");
                            $logStmt->execute([
                                $newId,
                                $_SERVER['REMOTE_ADDR'] ?? 'system',
                                json_encode($input)
                            ]);
                        }
                    }
                } catch (Exception $e) {
                    error_log("Failed to log group creation: " . $e->getMessage());
                }
                
                $stmt = $pdo->prepare("SELECT * FROM product_groups WHERE id = ?");
                $stmt->execute([$newId]);
                $group = $stmt->fetch(PDO::FETCH_ASSOC);
                
                echo json_encode(['ok' => true, 'data' => $group]);
            } catch (Exception $e) {
                error_log("Error creating product group: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    }
}

/**
 * Handle single product group (PUT, DELETE /api/product-groups/{id})
 */
function handleSingleProductGroup($pdo, $groupId) {
    $method = $_SERVER['REQUEST_METHOD'];
    error_log("handleSingleProductGroup: method=$method, groupId=$groupId");
    
    switch ($method) {
        case 'PUT':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                error_log("PUT product group: groupId=$groupId, input=" . json_encode($input));
                
                // Проверка существования группы
                $checkStmt = $pdo->prepare("SELECT id FROM product_groups WHERE id = ?");
                $checkStmt->execute([$groupId]);
                $existing = $checkStmt->fetch();
                if (!$existing) {
                    error_log("Group not found: groupId=$groupId");
                    http_response_code(404);
                    echo json_encode(['ok' => false, 'error' => 'Group not found', 'groupId' => $groupId]);
                    return;
                }
                
                // Проверка уникальности slug, если изменяется
                if (!empty($input['slug'])) {
                    $checkStmt = $pdo->prepare("SELECT id FROM product_groups WHERE slug = ? AND id != ?");
                    $checkStmt->execute([$input['slug'], $groupId]);
                    if ($checkStmt->fetch()) {
                        http_response_code(400);
                        echo json_encode(['ok' => false, 'error' => 'Group with this slug already exists']);
                        return;
                    }
                }
                
                // Проверка существования parent_id, если указан
                $parentId = null;
                if (isset($input['parent_id']) && $input['parent_id'] !== '' && $input['parent_id'] !== null) {
                    $parentId = intval($input['parent_id']);
                    if ($parentId > 0) {
                        // Нельзя сделать группу родителем самой себя
                        if ($parentId == $groupId) {
                            http_response_code(400);
                            echo json_encode(['ok' => false, 'error' => 'Group cannot be its own parent']);
                            return;
                        }
                        // Проверяем существование родительской группы
                        $checkParentStmt = $pdo->prepare("SELECT id FROM product_groups WHERE id = ?");
                        $checkParentStmt->execute([$parentId]);
                        if (!$checkParentStmt->fetch()) {
                            error_log("Warning: parent_id {$parentId} does not exist, setting to null");
                            $parentId = null;
                        }
                    } else {
                        $parentId = null;
                    }
                }
                
                // Получаем старые данные для логирования
                $oldStmt = $pdo->prepare("SELECT * FROM product_groups WHERE id = ?");
                $oldStmt->execute([$groupId]);
                $oldData = $oldStmt->fetch(PDO::FETCH_ASSOC);
                
                $stmt = $pdo->prepare("
                    UPDATE product_groups 
                    SET name = ?, slug = ?, parent_id = ?, default_unit = ?, 
                        default_category_stock = ?, default_account = ?, default_tax_group = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ");
                $stmt->execute([
                    $input['name'] ?? null,
                    $input['slug'] ?? null,
                    $parentId,
                    $input['default_unit'] ?? null,
                    $input['default_category_stock'] ?? null,
                    $input['default_account'] ?? null,
                    $input['default_tax_group'] ?? null,
                    $groupId
                ]);
                
                // Логируем изменение (если таблица существует)
                try {
                    $tableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='group_changes_log'")->fetch();
                    if ($tableCheck) {
                        $columns = $pdo->query("PRAGMA table_info(group_changes_log)")->fetchAll(PDO::FETCH_ASSOC);
                        $columnNames = array_column($columns, 'name');
                        if (in_array('group_id', $columnNames)) {
                            $logStmt = $pdo->prepare("
                                INSERT INTO group_changes_log (group_id, action, user_id, old_data, new_data)
                                VALUES (?, 'update', ?, ?, ?)
                            ");
                            $logStmt->execute([
                                $groupId,
                                $_SERVER['REMOTE_ADDR'] ?? 'system',
                                json_encode($oldData),
                                json_encode($input)
                            ]);
                        }
                    }
                } catch (Exception $e) {
                    error_log("Failed to log group change: " . $e->getMessage());
                }
                
                $stmt = $pdo->prepare("SELECT * FROM product_groups WHERE id = ?");
                $stmt->execute([$groupId]);
                $group = $stmt->fetch(PDO::FETCH_ASSOC);
                
                echo json_encode(['ok' => true, 'data' => $group]);
            } catch (Exception $e) {
                error_log("Error updating product group: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        case 'DELETE':
            try {
                // Проверка существования группы
                $checkStmt = $pdo->prepare("SELECT id FROM product_groups WHERE id = ?");
                $checkStmt->execute([$groupId]);
                if (!$checkStmt->fetch()) {
                    http_response_code(404);
                    echo json_encode(['ok' => false, 'error' => 'Group not found']);
                    return;
                }
                
                // Получаем данные группы для логирования
                $oldStmt = $pdo->prepare("SELECT * FROM product_groups WHERE id = ?");
                $oldStmt->execute([$groupId]);
                $oldData = $oldStmt->fetch(PDO::FETCH_ASSOC);
                
                // Логируем удаление (если таблица существует)
                try {
                    // Проверяем существование таблицы
                    $tableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='group_changes_log'")->fetch();
                    if ($tableCheck) {
                        // Проверяем структуру таблицы
                        $columns = $pdo->query("PRAGMA table_info(group_changes_log)")->fetchAll(PDO::FETCH_ASSOC);
                        $columnNames = array_column($columns, 'name');
                        
                        if (in_array('group_id', $columnNames)) {
                            $logStmt = $pdo->prepare("
                                INSERT INTO group_changes_log (group_id, action, user_id, old_data, new_data)
                                VALUES (?, 'delete', ?, ?, NULL)
                            ");
                            $logStmt->execute([
                                $groupId,
                                $_SERVER['REMOTE_ADDR'] ?? 'system',
                                json_encode($oldData)
                            ]);
                        } else {
                            error_log("Table group_changes_log exists but doesn't have group_id column");
                        }
                    }
                } catch (Exception $e) {
                    error_log("Failed to log group deletion: " . $e->getMessage());
                    // Не прерываем выполнение, если логирование не удалось
                }
                
                // Удаляем группу (товары остаются, но без group_id)
                $stmt = $pdo->prepare("DELETE FROM product_groups WHERE id = ?");
                $stmt->execute([$groupId]);
                
                // Обнуляем group_id у товаров этой группы (если колонка существует)
                try {
                    $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
                    $columnNames = array_column($columns, 'name');
                    if (in_array('group_id', $columnNames)) {
                        $updateStmt = $pdo->prepare("UPDATE products SET group_id = NULL WHERE group_id = ?");
                        $updateStmt->execute([$groupId]);
                    }
                } catch (Exception $e) {
                    error_log("Failed to update products group_id: " . $e->getMessage());
                }
                
                echo json_encode(['ok' => true, 'message' => 'Group deleted']);
            } catch (Exception $e) {
                error_log("Error deleting product group: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    }
}

/**
 * Generate slug from name
 */
function generateSlug($name) {
    $slug = mb_strtolower($name, 'UTF-8');
    $slug = preg_replace('/[^a-z0-9а-яё]+/u', '-', $slug);
    $slug = preg_replace('/^-|-$/', '', $slug);
    return $slug;
}

/**
 * Handle stock import from Kontur.Market (POST /api/inventory/importStock)
 */
function handleImportStock($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    try {
        // Создаем таблицу inventory_balances если её нет
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS inventory_balances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                warehouse_id INTEGER DEFAULT 1,
                quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
                unit TEXT DEFAULT 'шт',
                purchase_price DECIMAL(10,2),
                vat_rate TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        ");
        
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'File upload failed']);
            return;
        }
        
        $file = $_FILES['file'];
        $fileName = $file['name'];
        $fileTmpPath = $file['tmp_name'];
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        
        if (!in_array($fileExtension, ['csv', 'txt', 'xlsx', 'xls'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid file type. Allowed: CSV, TXT, XLSX, XLS']);
            return;
        }
        
        // Читаем файл
        $content = file_get_contents($fileTmpPath);
        if ($fileExtension === 'csv' || $fileExtension === 'txt') {
            $rows = parseCSVContent($content);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Excel files require server-side processing. Please convert to CSV.']);
            return;
        }
        
        $processed = 0;
        $documentsCreated = 0;
        $errors = [];
        
        $pdo->beginTransaction();
        
        foreach ($rows as $index => $row) {
            try {
                $name = trim($row['Наименование'] ?? $row['name'] ?? '');
                $barcode = trim($row['Штрихкод'] ?? $row['barcode'] ?? '');
                $quantity = parseFloatSafe($row['Остаток'] ?? $row['quantity'] ?? '0');
                $purchasePrice = parseFloatSafe($row['Закупочная цена'] ?? $row['purchase_price'] ?? '');
                $vatRate = parseVATRate($row['Ставка НДС'] ?? $row['vat_rate'] ?? '');
                $unit = trim($row['Ед. изм.'] ?? $row['unit'] ?? 'шт');
                $type = trim($row['Тип'] ?? $row['type'] ?? 'товар');
                
                if (empty($name)) {
                    $errors[] = "Строка " . ($index + 1) . ": Пустое наименование";
                    continue;
                }
                
                // Если остаток не указан, нулевой или отрицательный - остаток 0
                if ($quantity <= 0) {
                    $quantity = 0;
                }
                
                // Округление остатка
                $unitLower = strtolower($unit);
                $isWeighted = strpos($unitLower, 'кг') !== false || strpos($unitLower, 'г') !== false ||
                              strpos($unitLower, 'л') !== false || strpos($unitLower, 'мл') !== false;
                
                if ($isWeighted) {
                    $quantity = round($quantity, 3); // До 3 знаков
                } else {
                    $quantity = round($quantity); // До целого
                }
                
                // Ищем товар по штрихкоду или названию
                $product = null;
                if (!empty($barcode)) {
                    $stmt = $pdo->prepare("SELECT * FROM products WHERE sku = ? OR name = ? LIMIT 1");
                    $stmt->execute([$barcode, $name]);
                    $product = $stmt->fetch(PDO::FETCH_ASSOC);
                }
                
                if (!$product) {
                    $stmt = $pdo->prepare("SELECT * FROM products WHERE name = ? LIMIT 1");
                    $stmt->execute([$name]);
                    $product = $stmt->fetch(PDO::FETCH_ASSOC);
                }
                
                // Если товар не найден, создаем его (если есть остаток)
                if (!$product && $quantity > 0) {
                    $stmt = $pdo->prepare("
                        INSERT INTO products (name, sku, type, price, cost, weight, visible_on_site, available)
                        VALUES (?, ?, ?, 0, ?, ?, 0, 1)
                    ");
                    $stmt->execute([
                        $name,
                        $barcode ?: null,
                        $type === 'материал' ? 'ingredient' : 'product',
                        $purchasePrice ?: 0,
                        $unit
                    ]);
                    $productId = $pdo->lastInsertId();
                } else if ($product) {
                    $productId = $product['id'];
                } else {
                    // Товар не найден и остаток 0 - пропускаем
                    continue;
                }
                
                // Если есть остаток, создаем акт постановки
                if ($quantity > 0) {
                    // Создаем запись об остатке
                    $stmt = $pdo->prepare("
                        INSERT OR REPLACE INTO inventory_balances 
                        (product_id, warehouse_id, quantity, unit, purchase_price, vat_rate, updated_at)
                        VALUES (?, 1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ");
                    $stmt->execute([
                        $productId,
                        $quantity,
                        $unit,
                        $purchasePrice ?: null,
                        $vatRate ?: null
                    ]);
                    
                    $documentsCreated++;
                }
                
                $processed++;
            } catch (Exception $e) {
                $errors[] = "Строка " . ($index + 1) . ": " . $e->getMessage();
            }
        }
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => "Импорт завершен. Обработано: $processed, Создано актов: $documentsCreated",
            'processed' => $processed,
            'documents_created' => $documentsCreated,
            'errors' => count($errors),
            'errorMessages' => array_slice($errors, 0, 10)
        ]);
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("Stock import error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function parseCSVContent($content) {
    $lines = explode("\n", $content);
    $rows = [];
    $headers = null;
    
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line)) continue;
        
        $values = str_getcsv($line);
        if ($headers === null) {
            $headers = $values;
        } else {
            $row = [];
            foreach ($headers as $index => $header) {
                $row[trim($header)] = isset($values[$index]) ? trim($values[$index]) : '';
            }
            $rows[] = $row;
        }
    }
    
    return $rows;
}

function parseFloatSafe($value) {
    if (empty($value)) return null;
    $value = str_replace(',', '.', $value);
    $parsed = floatval($value);
    return is_nan($parsed) ? null : $parsed;
}

// parseVATRate уже определена выше, удаляем дубликат

/**
 * Handle account rules (GET, POST /api/onec/account-rules)
 */
function handleAccountRules($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Создаем таблицу если её нет
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS account_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL,
                type TEXT,
                product_id INTEGER,
                group_id INTEGER,
                warehouse_id INTEGER,
                account_code TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");
        
        // Добавляем product_id если его нет (миграция)
        try {
            $columns = $pdo->query("PRAGMA table_info(account_rules)")->fetchAll(PDO::FETCH_ASSOC);
            $columnNames = array_column($columns, 'name');
            if (!in_array('product_id', $columnNames)) {
                $pdo->exec("ALTER TABLE account_rules ADD COLUMN product_id INTEGER");
                error_log("Migration: Added 'product_id' column to account_rules table");
            }
        } catch (Exception $e) {
            error_log("Migration warning for account_rules.product_id: " . $e->getMessage());
        }
    } catch (Exception $e) {
        error_log("Error creating account_rules table: " . $e->getMessage());
    }
    
    switch ($method) {
        case 'GET':
            try {
                $stmt = $pdo->query("SELECT * FROM account_rules ORDER BY level, type");
                $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['ok' => true, 'data' => $rules]);
            } catch (Exception $e) {
                error_log("Error fetching account rules: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!isset($input['account_code']) || empty($input['account_code'])) {
                    http_response_code(400);
                    echo json_encode(['ok' => false, 'error' => 'account_code is required']);
                    return;
                }
                
                $stmt = $pdo->prepare("
                    INSERT INTO account_rules (level, type, product_id, group_id, warehouse_id, account_code, description)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $input['level'] ?? 'default',
                    $input['type'] ?? null,
                    $input['product_id'] ?? null,
                    $input['group_id'] ?? null,
                    $input['warehouse_id'] ?? null,
                    $input['account_code'],
                    $input['description'] ?? null
                ]);
                
                $newId = $pdo->lastInsertId();
                $stmt = $pdo->prepare("SELECT * FROM account_rules WHERE id = ?");
                $stmt->execute([$newId]);
                $rule = $stmt->fetch(PDO::FETCH_ASSOC);
                
                echo json_encode(['ok' => true, 'data' => $rule]);
            } catch (Exception $e) {
                error_log("Error creating account rule: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    }
}

/**
 * Handle single account rule (PUT, DELETE /api/onec/account-rules/{id})
 */
function handleSingleAccountRule($pdo, $ruleId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'PUT':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                $stmt = $pdo->prepare("
                    UPDATE account_rules 
                    SET level = ?, type = ?, product_id = ?, group_id = ?, warehouse_id = ?, 
                        account_code = ?, description = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ");
                $stmt->execute([
                    $input['level'] ?? 'default',
                    $input['type'] ?? null,
                    $input['product_id'] ?? null,
                    $input['group_id'] ?? null,
                    $input['warehouse_id'] ?? null,
                    $input['account_code'] ?? null,
                    $input['description'] ?? null,
                    $ruleId
                ]);
                
                $stmt = $pdo->prepare("SELECT * FROM account_rules WHERE id = ?");
                $stmt->execute([$ruleId]);
                $rule = $stmt->fetch(PDO::FETCH_ASSOC);
                
                echo json_encode(['ok' => true, 'data' => $rule]);
            } catch (Exception $e) {
                error_log("Error updating account rule: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        case 'DELETE':
            try {
                $stmt = $pdo->prepare("DELETE FROM account_rules WHERE id = ?");
                $stmt->execute([$ruleId]);
                echo json_encode(['ok' => true, 'message' => 'Rule deleted']);
            } catch (Exception $e) {
                error_log("Error deleting account rule: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    }
}

/**
 * Apply account rules to all products (POST /api/onec/apply-account-rules)
 */
function handleApplyAccountRules($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    try {
        // Загружаем правила
        $stmt = $pdo->query("SELECT * FROM account_rules ORDER BY 
            CASE level 
                WHEN 'default' THEN 1 
                WHEN 'type' THEN 2 
                WHEN 'group' THEN 3 
                WHEN 'warehouse' THEN 4 
            END");
        $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Если правил нет, создаем правила по умолчанию
        if (empty($rules)) {
            $defaultRules = [
                ['level' => 'default', 'type' => 'product', 'account_code' => '41.01', 'description' => 'Товары (готовая продукция)'],
                ['level' => 'default', 'type' => 'ingredient', 'account_code' => '10.01', 'description' => 'Ингредиенты/материалы'],
                ['level' => 'default', 'type' => 'dish', 'account_code' => '41.01', 'description' => 'Блюда'],
                ['level' => 'default', 'type' => 'semi_product', 'account_code' => '10.01', 'description' => 'Заготовки']
            ];
            
            $stmt = $pdo->prepare("
                INSERT INTO account_rules (level, type, account_code, description)
                VALUES (?, ?, ?, ?)
            ");
            foreach ($defaultRules as $rule) {
                $stmt->execute([$rule['level'], $rule['type'], $rule['account_code'], $rule['description']]);
            }
            
            $stmt = $pdo->query("SELECT * FROM account_rules");
            $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        // Загружаем все товары
        $stmt = $pdo->query("SELECT * FROM products");
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Добавляем поле account_code если его нет
        try {
            $pdo->exec("ALTER TABLE products ADD COLUMN account_code TEXT");
        } catch (Exception $e) {
            // Колонка уже существует
        }
        
        $updated = 0;
        $pdo->beginTransaction();
        
        foreach ($products as $product) {
            $accountCode = null;
            
            // Применяем правила по приоритету
            foreach ($rules as $rule) {
                $match = false;
                
                // Применяем правила по приоритету (как в 1С)
                if ($rule['level'] === 'item' && isset($rule['product_id']) && $rule['product_id'] == $product['id']) {
                    $match = true;
                } elseif ($rule['level'] === 'group' && isset($rule['group_id']) && $rule['group_id'] == $product['group_id']) {
                    $match = true;
                } elseif ($rule['level'] === 'type' && isset($rule['type']) && $rule['type'] === $product['type']) {
                    $match = true;
                } elseif ($rule['level'] === 'warehouse' && isset($rule['warehouse_id'])) {
                    // Для склада нужно проверить остатки товара
                    // Пока пропускаем, так как нет связи products-warehouses
                    $match = false;
                } elseif ($rule['level'] === 'default' && isset($rule['type']) && $rule['type'] === $product['type']) {
                    $match = true;
                }
                
                if ($match) {
                    $accountCode = $rule['account_code'];
                    break;
                }
            }
            
            // Если нашли правило, обновляем товар
            if ($accountCode) {
                $stmt = $pdo->prepare("UPDATE products SET account_code = ? WHERE id = ?");
                $stmt->execute([$accountCode, $product['id']]);
                $updated++;
            }
        }
        
        $pdo->commit();
        
        echo json_encode([
            'ok' => true,
            'message' => "Правила применены. Обновлено товаров: $updated",
            'updated' => $updated
        ]);
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("Error applying account rules: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Handle 1C import (POST /api/onec/import)
 */
function handleOneCImport($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    try {
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'File upload failed']);
            return;
        }
        
        $file = $_FILES['file'];
        $updateExisting = isset($_POST['updateExisting']) && $_POST['updateExisting'] === 'true';
        $autoAssignAccounts = isset($_POST['autoAssignAccounts']) && $_POST['autoAssignAccounts'] === 'true';
        
        // Получаем сопоставление полей из запроса
        $fieldMapping = [];
        if (isset($_POST['fieldMapping']) && !empty($_POST['fieldMapping'])) {
            $fieldMapping = json_decode($_POST['fieldMapping'], true);
            if (!is_array($fieldMapping)) {
                $fieldMapping = [];
            }
        }
        
        // Используем существующую функцию импорта товаров
        $content = file_get_contents($file['tmp_name']);
        $rows = parseCSVContent($content);
        
        // Добавляем поле account_code если его нет
        try {
            $pdo->exec("ALTER TABLE products ADD COLUMN account_code TEXT");
        } catch (Exception $e) {
            // Колонка уже существует
        }
        
        $imported = 0;
        $updated = 0;
        $errors = [];
        $pdo->beginTransaction();
        
        foreach ($rows as $row) {
            // Используем сопоставление полей, если оно задано
            $getMappedValue = function($systemField) use ($row, $fieldMapping) {
                // Если есть сопоставление, используем его
                if (isset($fieldMapping[$systemField]) && isset($row[$fieldMapping[$systemField]])) {
                    return trim($row[$fieldMapping[$systemField]] ?? '');
                }
                // Иначе пробуем стандартные имена
                $standardNames = [
                    'name' => ['Наименование', 'name', 'Название', 'title'],
                    'barcode' => ['Штрихкод', 'barcode', 'Штрих-код', 'ean'],
                    'sku' => ['Артикул', 'sku', 'SKU', 'article', 'Код товара'],
                    'type' => ['Тип', 'type', 'Тип номенклатуры', 'вид'],
                    'unit' => ['Единица измерения', 'unit', 'Ед. изм.', 'единица'],
                    'price' => ['Цена продажи', 'price', 'Цена', 'стоимость'],
                    'cost' => ['Закупочная цена', 'cost', 'Себестоимость', 'закупка'],
                    'vat_rate' => ['Ставка НДС', 'vat_rate', 'НДС', 'vat'],
                    'category' => ['Категория', 'category', 'Группа'],
                    'account_code' => ['Счёт учёта', 'account_code', 'Счет', 'account'],
                    'stock' => ['Остаток', 'stock', 'Количество', 'quantity'],
                    'description' => ['Описание', 'description', 'Комментарий']
                ];
                
                $names = $standardNames[$systemField] ?? [];
                foreach ($names as $name) {
                    if (isset($row[$name])) {
                        return trim($row[$name] ?? '');
                    }
                }
                return '';
            };
            
            $name = $getMappedValue('name');
            $barcode = $getMappedValue('barcode');
            $sku = $getMappedValue('sku') ?: $barcode;
            $type = $getMappedValue('type') ?: 'товар';
            $unit = $getMappedValue('unit');
            $price = $getMappedValue('price');
            $cost = $getMappedValue('cost');
            $vatRate = $getMappedValue('vat_rate');
            $category = $getMappedValue('category');
            $accountCode = $getMappedValue('account_code');
            $stock = $getMappedValue('stock');
            $description = $getMappedValue('description');
            
            if (empty($name)) continue;
            
            // Ищем товар
            $product = null;
            if (!empty($barcode)) {
                $stmt = $pdo->prepare("SELECT * FROM products WHERE sku = ? OR name = ? LIMIT 1");
                $stmt->execute([$barcode, $name]);
                $product = $stmt->fetch(PDO::FETCH_ASSOC);
            }
            
            if (!$product) {
                $stmt = $pdo->prepare("SELECT * FROM products WHERE name = ? LIMIT 1");
                $stmt->execute([$name]);
                $product = $stmt->fetch(PDO::FETCH_ASSOC);
            }
            
            if ($product && $updateExisting) {
                // Обновляем существующий товар
                $updateFields = [];
                $params = [];
                
                if (!empty($accountCode) || $autoAssignAccounts) {
                    // Нормализуем тип для функции getAccountByType
                    $typeMap = [
                        'товар' => 'product',
                        'материал' => 'ingredient',
                        'блюдо' => 'dish',
                        'заготовка' => 'semi_product',
                        'модификатор' => 'modifier'
                    ];
                    $normalizedType = $typeMap[strtolower($type)] ?? 'product';
                    $finalAccount = !empty($accountCode) ? $accountCode : getAccountByType($pdo, $normalizedType);
                    $updateFields[] = "account_code = ?";
                    $params[] = $finalAccount;
                }
                
                if (!empty($sku) && $sku !== $product['sku']) {
                    $updateFields[] = "sku = ?";
                    $params[] = $sku;
                }
                
                if (!empty($price)) {
                    $priceValue = floatval(str_replace(',', '.', $price));
                    if ($priceValue >= 0) { // Проверяем, что цена не отрицательная
                        $updateFields[] = "price = ?";
                        $params[] = $priceValue;
                    }
                }
                
                if (!empty($cost)) {
                    $updateFields[] = "cost = ?";
                    $params[] = floatval($cost);
                }
                
                if (!empty($vatRate)) {
                    $updateFields[] = "vat_rate = ?";
                    $params[] = $vatRate;
                }
                
                if (!empty($description)) {
                    $updateFields[] = "description = ?";
                    $params[] = $description;
                }
                
                if (!empty($updateFields)) {
                    $params[] = $product['id'];
                    $stmt = $pdo->prepare("UPDATE products SET " . implode(', ', $updateFields) . " WHERE id = ?");
                    $stmt->execute($params);
                    $updated++;
                }
            } else if (!$product) {
                // Создаем новый товар
                // Проверяем обязательные поля
                if (empty($name)) {
                    continue; // Пропускаем товары без названия
                }
                
                // Обрабатываем цену - она обязательна
                $priceValue = 0;
                if (!empty($price)) {
                    $priceValue = floatval(str_replace(',', '.', $price));
                    if ($priceValue < 0) {
                        $priceValue = 0; // Отрицательные цены не допускаются
                        $errors[] = "Товар '$name': цена отрицательная, установлена 0";
                    }
                } else {
                    // Если цена не указана, используем 0 и добавляем предупреждение
                    $errors[] = "Товар '$name': цена не указана, установлена 0";
                }
                
                $typeMap = [
                    'товар' => 'product',
                    'материал' => 'ingredient',
                    'блюдо' => 'dish',
                    'заготовка' => 'semi_product',
                    'модификатор' => 'modifier'
                ];
                $normalizedType = $typeMap[strtolower($type)] ?? 'product';
                $account = !empty($accountCode) ? $accountCode : ($autoAssignAccounts ? getAccountByType($pdo, $normalizedType) : null);
                
                $stmt = $pdo->prepare("
                    INSERT INTO products (name, sku, type, account_code, price, cost, vat_rate, description, visible_on_site, available)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
                ");
                $stmt->execute([
                    $name,
                    $sku ?: null,
                    $normalizedType,
                    $account,
                    $priceValue, // Всегда число, не null
                    !empty($cost) ? floatval(str_replace(',', '.', $cost)) : null,
                    !empty($vatRate) ? $vatRate : null,
                    !empty($description) ? $description : null
                ]);
                $imported++;
                
                // Если указан остаток, создаем запись на складе
                if (!empty($stock) && floatval($stock) > 0) {
                    try {
                        $warehouseId = 1; // Основной склад
                        $balanceStmt = $pdo->prepare("
                            INSERT INTO inventory_balances (product_id, warehouse_id, quantity, updated_at)
                            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                            ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + ?
                        ");
                        $productId = $pdo->lastInsertId();
                        $stockQty = floatval($stock);
                        $balanceStmt->execute([$productId, $warehouseId, $stockQty, $stockQty]);
                    } catch (Exception $e) {
                        error_log("Failed to create stock balance: " . $e->getMessage());
                    }
                }
            }
        }
        
        $pdo->commit();
        
        $message = "Импорт завершен. Создано: $imported, Обновлено: $updated";
        if (count($errors) > 0) {
            $message .= ". Предупреждений: " . count($errors);
        }
        
        echo json_encode([
            'success' => true,
            'ok' => true,
            'message' => $message,
            'imported' => $imported,
            'updated' => $updated,
            'warnings' => count($errors) > 0 ? array_slice($errors, 0, 20) : [],
            'warningCount' => count($errors)
        ]);
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("1C import error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Handle fix data issues (POST /api/fix-data-issues)
 */
function handleFixDataIssues($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    try {
        $results = [
            'categories' => ['fixed' => 0, 'total' => 0],
            'recipes' => ['created' => 0, 'total_dishes' => 0],
            'warehouse' => ['checked' => 0, 'fixed' => 0]
        ];
        
        $pdo->beginTransaction();
        
        // 0. ДОБАВЛЕНИЕ КОЛОНКИ type В ТАБЛИЦУ products (если её нет)
        error_log("=== 0. Проверка и добавление колонки type в таблицу products ===");
        
        $productsColumns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
        $hasTypeColumn = false;
        foreach ($productsColumns as $col) {
            if ($col['name'] === 'type') {
                $hasTypeColumn = true;
                break;
            }
        }
        
        if (!$hasTypeColumn) {
            try {
                $pdo->exec("ALTER TABLE products ADD COLUMN type TEXT DEFAULT 'product'");
                error_log("Добавлена колонка type в таблицу products");
                
                // Устанавливаем тип для существующих товаров на основе эвристики
                // Если есть SKU или категория "Напитки"/"Соусы" - это товар, иначе блюдо
                $pdo->exec("
                    UPDATE products 
                    SET type = CASE 
                        WHEN sku IS NOT NULL AND sku != '' THEN 'product'
                        WHEN category IN ('Напитки', 'Соусы', 'Допы') THEN 'product'
                        ELSE 'dish'
                    END
                    WHERE type IS NULL OR type = ''
                ");
                error_log("Установлен тип для существующих товаров");
            } catch (Exception $e) {
                error_log("Ошибка при добавлении колонки type: " . $e->getMessage());
            }
        }
        
        // 1. ПРИВЯЗКА ТОВАРОВ К КАТЕГОРИЯМ
        error_log("=== 1. Проверка связей товаров с категориями ===");
        
        // Проверяем существование таблицы product_category
        $tableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='product_category'")->fetch();
        if (!$tableCheck) {
            $pdo->exec("
                CREATE TABLE product_category (
                    product_id INTEGER NOT NULL,
                    category_id INTEGER NOT NULL,
                    PRIMARY KEY (product_id, category_id),
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
                )
            ");
            error_log("Создана таблица product_category");
        }
        
        // Проверяем, есть ли вообще товары в базе
        // Сначала проверяем существование таблицы products
        $productsTableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='products'")->fetch();
        if (!$productsTableCheck) {
            error_log("ВНИМАНИЕ: Таблица products не найдена в базе данных!");
            $totalProductsCount = 0;
        } else {
            $totalProducts = $pdo->query("SELECT COUNT(*) as cnt FROM products")->fetch(PDO::FETCH_ASSOC);
            $totalProductsCount = intval($totalProducts['cnt'] ?? 0);
            error_log("Всего товаров в таблице products: $totalProductsCount");
            
            // Проверяем таблицу synced_products (для синхронизированных товаров с сайта)
            $syncedProductsCountValue = 0;
            $syncedProductsTableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='synced_products'")->fetch();
            if ($syncedProductsTableCheck) {
                try {
                    $syncedProductsCount = $pdo->query("SELECT COUNT(*) as cnt FROM synced_products")->fetch(PDO::FETCH_ASSOC);
                    $syncedProductsCountValue = intval($syncedProductsCount['cnt'] ?? 0);
                    error_log("Всего товаров в таблице synced_products: $syncedProductsCountValue");
                } catch (Exception $e) {
                    error_log("Ошибка при проверке synced_products: " . $e->getMessage());
                }
            } else {
                error_log("Таблица synced_products не найдена");
            }
            
            // Проверяем наличие колонки type в таблице products
            $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
            $hasTypeColumn = false;
            $columnNames = [];
            foreach ($columns as $col) {
                $columnNames[] = $col['name'];
                if ($col['name'] === 'type') {
                    $hasTypeColumn = true;
                    break;
                }
            }
            error_log("Колонки в таблице products: " . implode(', ', $columnNames));
            
            if ($hasTypeColumn) {
                // Дополнительная диагностика: проверяем, есть ли товары с типом 'dish'
                try {
                    $dishesCount = $pdo->query("SELECT COUNT(*) as cnt FROM products WHERE type = 'dish'")->fetch(PDO::FETCH_ASSOC);
                    $dishesCountValue = intval($dishesCount['cnt'] ?? 0);
                    error_log("Товаров с типом 'dish': $dishesCountValue");
                } catch (Exception $e) {
                    error_log("Ошибка при проверке товаров с типом 'dish': " . $e->getMessage());
                }
            } else {
                error_log("Колонка 'type' не найдена в таблице products");
            }
            
            // Проверяем, есть ли товары вообще (без фильтра по типу)
            try {
                $allProducts = $pdo->query("SELECT id, name FROM products LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
                error_log("Примеры товаров в БД (первые 5): " . json_encode($allProducts));
            } catch (Exception $e) {
                error_log("Ошибка при получении примеров товаров: " . $e->getMessage());
            }
        }
        
        // Получаем все товары без категорий
        $productsWithoutCategories = $pdo->query("
            SELECT p.id, p.name, p.category
            FROM products p
            LEFT JOIN product_category pc ON p.id = pc.product_id
            WHERE pc.product_id IS NULL
        ")->fetchAll(PDO::FETCH_ASSOC);
        
        $results['categories']['total'] = count($productsWithoutCategories);
        error_log("Найдено товаров без категорий: " . count($productsWithoutCategories));
        
        // Если товаров нет вообще, возвращаем информацию об этом
        if ($totalProductsCount === 0) {
            error_log("ВНИМАНИЕ: В базе данных нет товаров!");
        }
        
        // Проверяем существование таблицы categories
        $categoriesTableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'")->fetch();
        if (!$categoriesTableCheck) {
            // Создаем таблицу categories, если её нет
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    parent_id INTEGER,
                    name TEXT NOT NULL,
                    slug TEXT UNIQUE,
                    description TEXT,
                    image_url TEXT,
                    type TEXT DEFAULT 'menu',
                    show_on_site BOOLEAN DEFAULT 1,
                    show_in_nav BOOLEAN DEFAULT 1,
                    position INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
                )
            ");
            error_log("Создана таблица categories");
        }
        
        // Получаем или создаем категорию "Другое"
        $defaultCategory = $pdo->query("SELECT id FROM categories WHERE name = 'Другое' OR slug = 'other' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
        
        if (!$defaultCategory) {
            // Создаем категорию "Другое"
            $stmt = $pdo->prepare("INSERT INTO categories (name, slug, type, show_on_site, show_in_nav) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute(['Другое', 'other', 'menu', 1, 0]);
            $defaultCategoryId = $pdo->lastInsertId();
            error_log("Создана категория 'Другое' (ID: $defaultCategoryId)");
        } else {
            $defaultCategoryId = $defaultCategory['id'];
        }
        
        // Привязываем товары к категории "Другое"
        $linkStmt = $pdo->prepare("INSERT OR IGNORE INTO product_category (product_id, category_id) VALUES (?, ?)");
        foreach ($productsWithoutCategories as $product) {
            try {
                $linkStmt->execute([$product['id'], $defaultCategoryId]);
                $results['categories']['fixed']++;
            } catch (Exception $e) {
                error_log("Ошибка привязки товара {$product['id']} к категории: " . $e->getMessage());
            }
        }
        
        error_log("Привязано товаров к категории 'Другое': {$results['categories']['fixed']}");
        
        // Также проверяем товары с полем category (старое поле) и переносим в product_category
        $productsWithOldCategory = $pdo->query("
            SELECT p.id, p.category
            FROM products p
            WHERE p.category IS NOT NULL AND p.category != ''
            AND NOT EXISTS (
                SELECT 1 FROM product_category pc WHERE pc.product_id = p.id
            )
        ")->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($productsWithOldCategory as $product) {
            $categoryName = trim($product['category']);
            // Ищем категорию по имени
            $category = $pdo->prepare("SELECT id FROM categories WHERE name = ? OR slug = ? LIMIT 1");
            $category->execute([$categoryName, $categoryName]);
            $cat = $category->fetch(PDO::FETCH_ASSOC);
            
            if ($cat) {
                try {
                    $linkStmt->execute([$product['id'], $cat['id']]);
                    $results['categories']['fixed']++;
                } catch (Exception $e) {
                    error_log("Ошибка привязки товара {$product['id']} к категории {$cat['id']}: " . $e->getMessage());
                }
            } else {
                // Если категория не найдена, привязываем к "Другое"
                try {
                    $linkStmt->execute([$product['id'], $defaultCategoryId]);
                    $results['categories']['fixed']++;
                } catch (Exception $e) {
                    error_log("Ошибка привязки товара {$product['id']} к категории 'Другое': " . $e->getMessage());
                }
            }
        }
        
        error_log("Всего привязано товаров к категориям: {$results['categories']['fixed']}");
        
        // 2. СОЗДАНИЕ ТЕХКАРТ ДЛЯ БЛЮД БЕЗ ТЕХКАРТ
        error_log("=== 2. Проверка техкарт для блюд ===");
        
        // Проверяем существование таблицы recipes
        $recipesTableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='recipes'")->fetch();
        if (!$recipesTableCheck) {
            // Создаем таблицу recipes, если её нет
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS recipes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    category_id INTEGER,
                    product_id INTEGER,
                    output_quantity DECIMAL(10,3) NOT NULL,
                    output_unit TEXT NOT NULL,
                    cooking_time INTEGER,
                    loss_percentage DECIMAL(5,2) DEFAULT 0,
                    cooking_instructions TEXT,
                    ingredients TEXT,
                    cost DECIMAL(10,2) DEFAULT 0,
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ");
            error_log("Создана таблица recipes");
        }
        
        // Проверяем наличие колонки product_id в recipes
        $columns = $pdo->query("PRAGMA table_info(recipes)")->fetchAll(PDO::FETCH_ASSOC);
        $hasProductId = false;
        foreach ($columns as $col) {
            if ($col['name'] === 'product_id') {
                $hasProductId = true;
                break;
            }
        }
        
        if (!$hasProductId) {
            try {
                $pdo->exec("ALTER TABLE recipes ADD COLUMN product_id INTEGER");
                error_log("Добавлена колонка product_id в таблицу recipes");
            } catch (Exception $e) {
                error_log("Не удалось добавить колонку product_id: " . $e->getMessage());
            }
        }
        
        // Получаем все блюда (type='dish') без техкарт
        // Проверяем наличие колонок в products
        $productsColumns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
        $hasTypeColumn = false;
        $hasCostColumn = false;
        foreach ($productsColumns as $col) {
            if ($col['name'] === 'type') {
                $hasTypeColumn = true;
            }
            if ($col['name'] === 'cost') {
                $hasCostColumn = true;
            }
        }
        
        // Добавляем колонку cost, если её нет
        if (!$hasCostColumn) {
            try {
                $pdo->exec("ALTER TABLE products ADD COLUMN cost DECIMAL(10,2)");
                error_log("Добавлена колонка cost в таблицу products");
                $hasCostColumn = true;
            } catch (Exception $e) {
                error_log("Не удалось добавить колонку cost: " . $e->getMessage());
            }
        }
        
        if ($hasTypeColumn) {
            // Проверяем, сколько всего блюд в базе
            $totalDishes = $pdo->query("SELECT COUNT(*) as cnt FROM products WHERE type = 'dish'")->fetch(PDO::FETCH_ASSOC);
            $totalDishesCount = intval($totalDishes['cnt'] ?? 0);
            error_log("Всего блюд (type='dish') в базе: $totalDishesCount");
            
            // Проверяем, сколько блюд уже имеют техкарты
            $dishesWithRecipes = $pdo->query("
                SELECT COUNT(DISTINCT p.id) as cnt
                FROM products p
                INNER JOIN recipes r ON p.id = r.product_id
                WHERE p.type = 'dish'
            ")->fetch(PDO::FETCH_ASSOC);
            $dishesWithRecipesCount = intval($dishesWithRecipes['cnt'] ?? 0);
            error_log("Блюд с техкартами: $dishesWithRecipesCount");
            
            // Формируем SELECT с учетом наличия колонок
            $selectFields = ['p.id', 'p.name', 'p.price', 'p.description'];
            if ($hasCostColumn) {
                $selectFields[] = 'p.cost';
            }
            
            $sql = "
                SELECT " . implode(', ', $selectFields) . "
                FROM products p
                LEFT JOIN recipes r ON p.id = r.product_id
                WHERE p.type = 'dish' AND r.id IS NULL
            ";
            
            $dishesWithoutRecipes = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // Если колонки type нет, пропускаем создание техкарт
            $dishesWithoutRecipes = [];
            error_log("Колонка type не найдена в таблице products, пропускаем создание техкарт");
        }
        
        $results['recipes']['total_dishes'] = count($dishesWithoutRecipes);
        error_log("Найдено блюд без техкарт: " . count($dishesWithoutRecipes));
        
        // Создаем базовые техкарты для блюд
        $recipeStmt = $pdo->prepare("
            INSERT INTO recipes (name, product_id, output_quantity, output_unit, cooking_time, ingredients, cost, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        foreach ($dishesWithoutRecipes as $dish) {
            try {
                $dishCost = isset($dish['cost']) ? floatval($dish['cost']) : 0;
                $recipeStmt->execute([
                    $dish['name'],
                    $dish['id'],
                    1, // Выход: 1 порция
                    'шт', // Единица измерения
                    30, // Время приготовления: 30 минут
                    json_encode([]), // Пустой список ингредиентов (нужно будет заполнить вручную)
                    $dishCost, // Себестоимость из товара
                    1 // Активна
                ]);
                $results['recipes']['created']++;
            } catch (Exception $e) {
                error_log("Ошибка создания техкарты для блюда {$dish['id']}: " . $e->getMessage());
            }
        }
        
        error_log("Создано техкарт: {$results['recipes']['created']}");
        
        // 3. ПРОВЕРКА ДАННЫХ В СКЛАДЕ
        error_log("=== 3. Проверка данных в складе ===");
        
        // Проверяем наличие таблицы inventory_balances
        $tableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_balances'")->fetch();
        if (!$tableCheck) {
            error_log("Таблица inventory_balances не найдена, пропускаем проверку склада");
            $results['warehouse']['checked'] = 0;
        } else {
            // Получаем общее количество записей на складе
            $totalBalances = $pdo->query("SELECT COUNT(*) as cnt FROM inventory_balances")->fetch(PDO::FETCH_ASSOC);
            $totalBalancesCount = intval($totalBalances['cnt'] ?? 0);
            error_log("Всего записей на складе: $totalBalancesCount");
            
            // Получаем все записи с проблемами (NULL или пустые значения)
            $problematicBalances = $pdo->query("
                SELECT ib.id, ib.product_id, ib.quantity, ib.warehouse_id
                FROM inventory_balances ib
                LEFT JOIN products p ON ib.product_id = p.id
                WHERE p.id IS NULL OR ib.quantity IS NULL
            ")->fetchAll(PDO::FETCH_ASSOC);
            
            $results['warehouse']['checked'] = $totalBalancesCount;
            error_log("Проверено записей на складе: {$results['warehouse']['checked']}");
            error_log("Найдено проблемных записей: " . count($problematicBalances));
            
            // Удаляем записи с несуществующими товарами
            $deleteStmt = $pdo->prepare("DELETE FROM inventory_balances WHERE product_id NOT IN (SELECT id FROM products)");
            $deleteStmt->execute();
            $deleted = $deleteStmt->rowCount();
            
            // Устанавливаем 0 для NULL количеств
            $updateStmt = $pdo->prepare("UPDATE inventory_balances SET quantity = 0 WHERE quantity IS NULL");
            $updateStmt->execute();
            $updated = $updateStmt->rowCount();
            
            $results['warehouse']['fixed'] = $deleted + $updated;
            error_log("Исправлено записей: {$results['warehouse']['fixed']} (удалено: $deleted, обновлено: $updated)");
        }
        
        $pdo->commit();
        
        error_log("=== РЕЗУЛЬТАТЫ ===");
        error_log("Категории: привязано {$results['categories']['fixed']} из {$results['categories']['total']} товаров");
        error_log("Техкарты: создано {$results['recipes']['created']} из {$results['recipes']['total_dishes']} блюд");
        error_log("Склад: исправлено {$results['warehouse']['fixed']} из {$results['warehouse']['checked']} записей");
        
        // Собираем диагностическую информацию
        $diagnostics = [
            'total_products' => isset($totalProductsCount) ? $totalProductsCount : 0,
            'total_dishes' => isset($totalDishesCount) ? $totalDishesCount : 0,
            'total_balances' => isset($totalBalancesCount) ? $totalBalancesCount : 0,
            'products_table_exists' => isset($productsTableCheck) ? (bool)$productsTableCheck : false,
            'synced_products_count' => isset($syncedProductsCountValue) ? $syncedProductsCountValue : 0,
            'products_table_columns' => isset($columnNames) ? $columnNames : [],
            'has_type_column' => isset($hasTypeColumn) ? $hasTypeColumn : false,
            'sample_products' => isset($allProducts) ? $allProducts : []
        ];
        
        // Формируем детальное сообщение
        $message = 'Данные успешно исправлены';
        if ($diagnostics['total_products'] === 0 && $diagnostics['synced_products_count'] === 0) {
            $message .= '. В базе данных нет товаров в таблице products.';
            if ($diagnostics['synced_products_count'] > 0) {
                $message .= " Найдено {$diagnostics['synced_products_count']} товаров в таблице synced_products (синхронизированные с сайтом).";
            }
        } else {
            $message .= ". Найдено {$diagnostics['total_products']} товаров в таблице products.";
        }
        
        echo json_encode([
            'success' => true,
            'ok' => true,
            'results' => $results,
            'diagnostics' => $diagnostics,
            'message' => $message
        ]);
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("Fix data issues error: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'ok' => false,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
    }
}

/**
 * Handle sync products from synced_products table (POST /api/sync-products-from-synced)
 */
function handleSyncProductsFromSynced($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    try {
        $results = [
            'synced_products_found' => 0,
            'products_imported' => 0,
            'products_updated' => 0,
            'errors' => []
        ];
        
        $pdo->beginTransaction();
        
        // Проверяем существование таблицы synced_products
        $syncedTableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='synced_products'")->fetch();
        if (!$syncedTableCheck) {
            throw new Exception('Таблица synced_products не найдена');
        }
        
        // Получаем все записи из synced_products
        $syncedProducts = $pdo->query("SELECT id, product_data, synced_at FROM synced_products ORDER BY synced_at DESC")->fetchAll(PDO::FETCH_ASSOC);
        $results['synced_products_found'] = count($syncedProducts);
        
        error_log("Найдено записей в synced_products: " . $results['synced_products_found']);
        
        // Проверяем структуру таблицы products
        $productsColumns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_column($productsColumns, 'name');
        $hasTypeColumn = in_array('type', $columnNames);
        $hasVisibleOnSite = in_array('visible_on_site', $columnNames);
        $hasAvailable = in_array('available', $columnNames);
        $hasCost = in_array('cost', $columnNames);
        $hasSku = in_array('sku', $columnNames);
        $hasWeight = in_array('weight', $columnNames);
        $hasCalories = in_array('calories', $columnNames);
        
        // Обрабатываем каждую запись
        foreach ($syncedProducts as $synced) {
            try {
                $productData = json_decode($synced['product_data'], true);
                
                if (!is_array($productData)) {
                    // Если это не массив, возможно это один товар
                    $products = [$productData];
                } else {
                    // Если это массив товаров
                    $products = $productData;
                }
                
                foreach ($products as $product) {
                    if (!isset($product['name']) || empty($product['name'])) {
                        continue; // Пропускаем товары без имени
                    }
                    
                    $name = trim($product['name']);
                    $description = $product['description'] ?? $product['desc'] ?? '';
                    $price = isset($product['price']) ? floatval($product['price']) : 0;
                    $cost = isset($product['cost']) ? floatval($product['cost'] ?? 0) : null;
                    $sku = $product['sku'] ?? null;
                    $category = $product['category'] ?? $product['cat'] ?? null;
                    $picture = $product['picture'] ?? $product['image_url'] ?? $product['photo'] ?? $product['image'] ?? '';
                    $available = isset($product['available']) ? ($product['available'] ? 1 : 0) : 1;
                    $visibleOnSite = isset($product['visible_on_site']) ? ($product['visible_on_site'] ? 1 : 0) : 1;
                    
                    // ✅ КРИТИЧНО: Извлекаем weight и calories
                    $weight = isset($product['weight']) && $product['weight'] !== null && $product['weight'] !== '' 
                        ? $product['weight'] 
                        : null;
                    $calories = isset($product['calories']) && $product['calories'] !== null && $product['calories'] !== '' 
                        ? (is_numeric($product['calories']) ? intval($product['calories']) : $product['calories'])
                        : null;
                    
                    // Определяем тип товара
                    $type = 'product'; // По умолчанию
                    if (isset($product['type'])) {
                        $type = $product['type'];
                    } elseif (isset($product['item_type'])) {
                        $type = $product['item_type'];
                    } else {
                        // Эвристика: если есть SKU или категория "Напитки"/"Соусы" - это товар, иначе блюдо
                        if ($sku || ($category && in_array($category, ['Напитки', 'Соусы', 'Допы']))) {
                            $type = 'product';
                        } else {
                            $type = 'dish';
                        }
                    }
                    
                    // Нормализуем тип
                    $typeMap = [
                        'товар' => 'product',
                        'материал' => 'ingredient',
                        'блюдо' => 'dish',
                        'заготовка' => 'semi_product',
                        'модификатор' => 'modifier'
                    ];
                    $type = $typeMap[strtolower($type)] ?? $type;
                    
                    // Проверяем, существует ли товар с таким именем
                    $existing = $pdo->prepare("SELECT id FROM products WHERE name = ? LIMIT 1");
                    $existing->execute([$name]);
                    $existingProduct = $existing->fetch(PDO::FETCH_ASSOC);
                    
                    if ($existingProduct) {
                        // Обновляем существующий товар
                        $updateFields = [];
                        $updateParams = [];
                        
                        if ($hasTypeColumn) {
                            $updateFields[] = "type = ?";
                            $updateParams[] = $type;
                        }
                        
                        if ($hasCost && $cost !== null) {
                            $updateFields[] = "cost = ?";
                            $updateParams[] = $cost;
                        }
                        
                        if ($hasSku && $sku) {
                            $updateFields[] = "sku = ?";
                            $updateParams[] = $sku;
                        }
                        
                        $updateFields[] = "price = ?";
                        $updateParams[] = $price;
                        
                        $updateFields[] = "description = ?";
                        $updateParams[] = $description;
                        
                        if ($hasVisibleOnSite) {
                            $updateFields[] = "visible_on_site = ?";
                            $updateParams[] = $visibleOnSite;
                        }
                        
                        if ($hasAvailable) {
                            $updateFields[] = "available = ?";
                            $updateParams[] = $available;
                        }
                        
                        // ✅ КРИТИЧНО: Добавляем weight и calories в UPDATE
                        if ($hasWeight && $weight !== null) {
                            $updateFields[] = "weight = ?";
                            $updateParams[] = $weight;
                        }
                        
                        if ($hasCalories && $calories !== null) {
                            $updateFields[] = "calories = ?";
                            $updateParams[] = $calories;
                        }
                        
                        if (!empty($updateFields)) {
                            $updateParams[] = $existingProduct['id'];
                            $updateSql = "UPDATE products SET " . implode(', ', $updateFields) . " WHERE id = ?";
                            $updateStmt = $pdo->prepare($updateSql);
                            $updateStmt->execute($updateParams);
                            $results['products_updated']++;
                        }
                    } else {
                        // Создаем новый товар
                        $insertFields = ['name', 'description', 'price'];
                        $insertValues = ['?', '?', '?'];
                        $insertParams = [$name, $description, $price];
                        
                        if ($hasTypeColumn) {
                            $insertFields[] = 'type';
                            $insertValues[] = '?';
                            $insertParams[] = $type;
                        }
                        
                        if ($hasCost && $cost !== null) {
                            $insertFields[] = 'cost';
                            $insertValues[] = '?';
                            $insertParams[] = $cost;
                        }
                        
                        if ($hasSku && $sku) {
                            $insertFields[] = 'sku';
                            $insertValues[] = '?';
                            $insertParams[] = $sku;
                        }
                        
                        if ($hasVisibleOnSite) {
                            $insertFields[] = 'visible_on_site';
                            $insertValues[] = '?';
                            $insertParams[] = $visibleOnSite;
                        }
                        
                        if ($hasAvailable) {
                            $insertFields[] = 'available';
                            $insertValues[] = '?';
                            $insertParams[] = $available;
                        }
                        
                        // ✅ КРИТИЧНО: Добавляем weight и calories в INSERT
                        if ($hasWeight && $weight !== null) {
                            $insertFields[] = 'weight';
                            $insertValues[] = '?';
                            $insertParams[] = $weight;
                        }
                        
                        if ($hasCalories && $calories !== null) {
                            $insertFields[] = 'calories';
                            $insertValues[] = '?';
                            $insertParams[] = $calories;
                        }
                        
                        $insertSql = "INSERT INTO products (" . implode(', ', $insertFields) . ") VALUES (" . implode(', ', $insertValues) . ")";
                        $insertStmt = $pdo->prepare($insertSql);
                        $insertStmt->execute($insertParams);
                        $results['products_imported']++;
                    }
                }
            } catch (Exception $e) {
                $results['errors'][] = "Ошибка обработки записи synced_products ID {$synced['id']}: " . $e->getMessage();
                error_log("Ошибка обработки synced_products ID {$synced['id']}: " . $e->getMessage());
            }
        }
        
        $pdo->commit();
        
        error_log("Синхронизация завершена: импортировано {$results['products_imported']}, обновлено {$results['products_updated']}");
        
        echo json_encode([
            'success' => true,
            'ok' => true,
            'results' => $results,
            'message' => "Синхронизация завершена. Импортировано: {$results['products_imported']}, обновлено: {$results['products_updated']}"
        ]);
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("Sync products from synced error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'ok' => false,
            'error' => $e->getMessage()
        ]);
    }
}

/**
 * Handle 1C export (GET /api/onec/export)
 */
function handleOneCExport($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    try {
        $type = $_GET['type'] ?? 'sales';
        $dateFrom = $_GET['date_from'] ?? date('Y-m-d', strtotime('-30 days'));
        $dateTo = $_GET['date_to'] ?? date('Y-m-d');
        $format = $_GET['format'] ?? 'csv';
        
        if ($type === 'sales') {
            // Экспорт продаж
            // ✅ ВАЖНО: идентифицируем товар по variantId/productId из заказа, а не по имени
            $stmt = $pdo->prepare("
                SELECT 
                    o.created_at as date,
                    json_extract(oi.value, '$.name') as name,
                    json_extract(oi.value, '$.qty') as quantity,
                    json_extract(oi.value, '$.price') as price,
                    COALESCE(pv.account_code, pp.account_code) as account_code,
                    '20' as vat_rate
                FROM orders o
                CROSS JOIN json_each(json(o.items)) oi
                LEFT JOIN products pv ON pv.id = CAST(json_extract(oi.value, '$.variantId') AS INTEGER)
                LEFT JOIN products pp ON pp.id = CAST(COALESCE(json_extract(oi.value, '$.productId'), json_extract(oi.value, '$.id')) AS INTEGER)
                WHERE DATE(o.created_at) BETWEEN ? AND ?
                ORDER BY o.created_at
            ");
            $stmt->execute([$dateFrom, $dateTo]);
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $csv = "Дата продажи,Наименование,Количество,Цена продажи,Ставка НДС,Счёт учёта\n";
            foreach ($data as $row) {
                $csv .= sprintf(
                    "%s,\"%s\",%s,%s,%s,%s\n",
                    $row['date'],
                    str_replace('"', '""', $row['name'] ?? ''),
                    $row['quantity'] ?? '1',
                    $row['price'] ?? '0',
                    $row['vat_rate'] ?? '20',
                    $row['account_code'] ?? ''
                );
            }
            
        } elseif ($type === 'stock') {
            // Экспорт остатков
            $stmt = $pdo->query("
                SELECT 
                    p.name,
                    p.sku,
                    COALESCE(ib.quantity, 0) as quantity,
                    COALESCE(ib.unit, 'шт') as unit,
                    ib.purchase_price,
                    p.account_code
                FROM products p
                LEFT JOIN inventory_balances ib ON p.id = ib.product_id
                ORDER BY p.name
            ");
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $csv = "Наименование,Штрихкод,Количество,Ед. изм.,Закупочная цена,Счёт учёта\n";
            foreach ($data as $row) {
                $csv .= sprintf(
                    "\"%s\",%s,%s,%s,%s,%s\n",
                    str_replace('"', '""', $row['name'] ?? ''),
                    $row['sku'] ?? '',
                    $row['quantity'] ?? '0',
                    $row['unit'] ?? 'шт',
                    $row['purchase_price'] ?? '',
                    $row['account_code'] ?? ''
                );
            }
            
        } elseif ($type === 'nomenclature') {
            // Экспорт номенклатуры (расширенный)
            $stmt = $pdo->query("
                SELECT 
                    name,
                    sku,
                    barcode,
                    type,
                    price,
                    cost,
                    weight,
                    unit,
                    account_code,
                    description
                FROM products
                ORDER BY name
            ");
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $csv = "Наименование,Штрихкод,Артикул,Тип,Цена продажи,Себестоимость,Вес,Ед. изм.,Счёт учёта,Описание\n";
            foreach ($data as $row) {
                $csv .= sprintf(
                    "\"%s\",%s,%s,%s,%s,%s,\"%s\",%s,%s,\"%s\"\n",
                    str_replace('"', '""', $row['name'] ?? ''),
                    $row['barcode'] ?? '',
                    $row['sku'] ?? '',
                    $row['type'] ?? 'product',
                    $row['price'] ?? '0',
                    $row['cost'] ?? '0',
                    str_replace('"', '""', $row['weight'] ?? ''),
                    $row['unit'] ?? 'шт',
                    $row['account_code'] ?? '',
                    str_replace('"', '""', $row['description'] ?? '')
                );
            }
        } else {
            // Экспорт номенклатуры (базовый)
            $stmt = $pdo->query("
                SELECT 
                    name,
                    sku,
                    type,
                    price,
                    cost,
                    account_code
                FROM products
                ORDER BY name
            ");
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $csv = "Наименование,Штрихкод,Тип,Цена продажи,Себестоимость,Счёт учёта\n";
            foreach ($data as $row) {
                $csv .= sprintf(
                    "\"%s\",%s,%s,%s,%s,%s\n",
                    str_replace('"', '""', $row['name'] ?? ''),
                    $row['sku'] ?? '',
                    $row['type'] ?? 'product',
                    $row['price'] ?? '0',
                    $row['cost'] ?? '0',
                    $row['account_code'] ?? ''
                );
            }
        }
        
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="onec_export_' . $type . '_' . date('Y-m-d') . '.csv"');
        echo "\xEF\xBB\xBF" . $csv; // BOM for Excel
        exit;
        
    } catch (Exception $e) {
        error_log("1C export error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Handle modifiers (GET, POST /api/modifiers)
 */
function handleModifiers($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            try {
                // ✅ Убеждаемся, что таблицы существуют
                ensureItemOptionsTable($pdo);
                
                $stmt = $pdo->query("SELECT * FROM item_options ORDER BY group_name, sort_order, id");
                $modifiers = $stmt->fetchAll(PDO::FETCH_ASSOC);

                foreach ($modifiers as &$modifier) {
                    if (isset($modifier['is_visible'])) {
                        $modifier['is_visible'] = (bool) $modifier['is_visible'];
                    }
                    if (isset($modifier['show_in_product_card'])) {
                        $modifier['show_in_product_card'] = (bool) $modifier['show_in_product_card'];
                    }
                }
                unset($modifier);
                
                // ✅ ИСПРАВЛЕНО: Нормализуем пути к изображениям
                foreach ($modifiers as &$modifier) {
                    if (!empty($modifier['image_url'])) {
                        $imgUrl = trim($modifier['image_url']);
                        // Windows paths from import: storage\catalog\...
                        $imgUrl = str_replace('\\', '/', $imgUrl);
                        // Если путь относительный без /, добавляем /
                        if (!preg_match('/^https?:\/\//', $imgUrl) && !str_starts_with($imgUrl, '/')) {
                            $imgUrl = '/' . $imgUrl;
                        }
                        // Если путь начинается с storage, добавляем /
                        if (str_starts_with($imgUrl, 'storage/')) {
                            $imgUrl = '/' . $imgUrl;
                        }
                        $modifier['image_url'] = $imgUrl;
                    }
                }
                unset($modifier);
                
                // ✅ Добавлено: Загружаем категории для каждого модификатора
                try {
                    $catStmt = $pdo->prepare("SELECT category_id FROM item_option_category WHERE item_option_id = ?");
                    foreach ($modifiers as &$modifier) {
                        try {
                            $catStmt->execute([$modifier['id']]);
                            $modifier['category_ids'] = array_column($catStmt->fetchAll(PDO::FETCH_ASSOC), 'category_id');
                        } catch (Exception $e) {
                            // Если таблица не существует, просто пустой массив
                            $modifier['category_ids'] = [];
                        }
                    }
                    unset($modifier);
                } catch (Exception $e) {
                    // Если таблица категорий не существует, просто добавляем пустые массивы
                    foreach ($modifiers as &$modifier) {
                        $modifier['category_ids'] = [];
                    }
                    unset($modifier);
                }
                
                echo json_encode(['ok' => true, 'data' => $modifiers]);
            } catch (Exception $e) {
                error_log("Error fetching modifiers: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);

                try {
                    $pdo->exec("ALTER TABLE item_options ADD COLUMN image_url TEXT");
                } catch (Exception $e) {
                    // Column already exists
                }

                try {
                    $pdo->exec("ALTER TABLE item_options ADD COLUMN show_in_product_card BOOLEAN DEFAULT 1");
                } catch (Exception $e) {
                    // Column already exists
                }
                
                if (empty($input['option_name'])) {
                    http_response_code(400);
                    echo json_encode(['ok' => false, 'error' => 'option_name is required']);
                    return;
                }
                
                $stmt = $pdo->prepare("
                    INSERT INTO item_options 
                    (item_id, group_code, group_name, type, option_code, option_name, image_url, price_mode, price_value, max_qty, default_on, is_visible, show_in_product_card, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                
                $stmt->execute([
                    $input['item_id'] ?? null,
                    $input['group_code'] ?? null,
                    $input['group_name'] ?? null,
                    $input['type'] ?? 'switch',
                    $input['option_code'] ?? null,
                    $input['option_name'],
                    $input['image_url'] ?? null,
                    $input['price_mode'] ?? 'fixed',
                    $input['price_value'] ?? 0,
                    $input['max_qty'] ?? null,
                    $input['default_on'] ?? 0,
                    $input['is_visible'] ?? 1,
                    $input['show_in_product_card'] ?? 1,
                    $input['sort_order'] ?? 0
                ]);
                
                $newId = $pdo->lastInsertId();
                
                // ✅ Добавлено: Сохраняем связи с категориями
                if (isset($input['category_ids']) && is_array($input['category_ids']) && count($input['category_ids']) > 0) {
                    $catStmt = $pdo->prepare("INSERT OR IGNORE INTO item_option_category (item_option_id, category_id) VALUES (?, ?)");
                    foreach ($input['category_ids'] as $catId) {
                        if ($catId && $catId !== '') {
                            $catStmt->execute([$newId, $catId]);
                        }
                    }
                }
                
                $stmt = $pdo->prepare("SELECT * FROM item_options WHERE id = ?");
                $stmt->execute([$newId]);
                $modifier = $stmt->fetch(PDO::FETCH_ASSOC);
                
                // ✅ Добавлено: Загружаем категории модификатора
                $catStmt = $pdo->prepare("SELECT category_id FROM item_option_category WHERE item_option_id = ?");
                $catStmt->execute([$newId]);
                $modifier['category_ids'] = array_column($catStmt->fetchAll(PDO::FETCH_ASSOC), 'category_id');
                
                echo json_encode(['ok' => true, 'data' => $modifier]);
            } catch (Exception $e) {
                error_log("Error creating modifier: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    }
}

/**
 * Handle single modifier (PUT, DELETE /api/modifiers/{id})
 */
function handleSingleModifier($pdo, $modifierId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'PUT':
            try {
                $input = json_decode(file_get_contents('php://input'), true);

                try {
                    $pdo->exec("ALTER TABLE item_options ADD COLUMN image_url TEXT");
                } catch (Exception $e) {
                    // Column already exists
                }

                try {
                    $pdo->exec("ALTER TABLE item_options ADD COLUMN show_in_product_card BOOLEAN DEFAULT 1");
                } catch (Exception $e) {
                    // Column already exists
                }
                
                $checkStmt = $pdo->prepare("SELECT id FROM item_options WHERE id = ?");
                $checkStmt->execute([$modifierId]);
                if (!$checkStmt->fetch()) {
                    http_response_code(404);
                    echo json_encode(['ok' => false, 'error' => 'Modifier not found']);
                    return;
                }
                
                $stmt = $pdo->prepare("
                    UPDATE item_options 
                    SET item_id = ?, group_code = ?, group_name = ?, type = ?, option_code = ?, 
                        option_name = ?, image_url = ?, price_mode = ?, price_value = ?, max_qty = ?, 
                        default_on = ?, is_visible = ?, show_in_product_card = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ");
                
                $stmt->execute([
                    $input['item_id'] ?? null,
                    $input['group_code'] ?? null,
                    $input['group_name'] ?? null,
                    $input['type'] ?? 'switch',
                    $input['option_code'] ?? null,
                    $input['option_name'],
                    $input['image_url'] ?? null,
                    $input['price_mode'] ?? 'fixed',
                    $input['price_value'] ?? 0,
                    $input['max_qty'] ?? null,
                    $input['default_on'] ?? 0,
                    $input['is_visible'] ?? 1,
                    $input['show_in_product_card'] ?? 1,
                    $input['sort_order'] ?? 0,
                    $modifierId
                ]);
                
                // ✅ Добавлено: Обновляем связи с категориями
                if (isset($input['category_ids'])) {
                    // Удаляем старые связи
                    $delStmt = $pdo->prepare("DELETE FROM item_option_category WHERE item_option_id = ?");
                    $delStmt->execute([$modifierId]);
                    
                    // Добавляем новые связи
                    if (is_array($input['category_ids']) && count($input['category_ids']) > 0) {
                        $catStmt = $pdo->prepare("INSERT OR IGNORE INTO item_option_category (item_option_id, category_id) VALUES (?, ?)");
                        foreach ($input['category_ids'] as $catId) {
                            if ($catId && $catId !== '') {
                                $catStmt->execute([$modifierId, $catId]);
                            }
                        }
                    }
                }
                
                $stmt = $pdo->prepare("SELECT * FROM item_options WHERE id = ?");
                $stmt->execute([$modifierId]);
                $modifier = $stmt->fetch(PDO::FETCH_ASSOC);
                
                // ✅ ИСПРАВЛЕНО: Нормализуем путь к изображению
                if (!empty($modifier['image_url'])) {
                    $imgUrl = trim($modifier['image_url']);
                    // Windows paths from import: storage\catalog\...
                    $imgUrl = str_replace('\\', '/', $imgUrl);
                    if (!preg_match('/^https?:\/\//', $imgUrl) && !str_starts_with($imgUrl, '/')) {
                        $imgUrl = '/' . $imgUrl;
                    }
                    if (str_starts_with($imgUrl, 'storage/')) {
                        $imgUrl = '/' . $imgUrl;
                    }
                    $modifier['image_url'] = $imgUrl;
                }
                
                // ✅ Добавлено: Загружаем категории модификатора
                $catStmt = $pdo->prepare("SELECT category_id FROM item_option_category WHERE item_option_id = ?");
                $catStmt->execute([$modifierId]);
                $modifier['category_ids'] = array_column($catStmt->fetchAll(PDO::FETCH_ASSOC), 'category_id');
                
                echo json_encode(['ok' => true, 'data' => $modifier]);
            } catch (Exception $e) {
                error_log("Error updating modifier: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        case 'DELETE':
            try {
                $checkStmt = $pdo->prepare("SELECT id FROM item_options WHERE id = ?");
                $checkStmt->execute([$modifierId]);
                if (!$checkStmt->fetch()) {
                    http_response_code(404);
                    echo json_encode(['ok' => false, 'error' => 'Modifier not found']);
                    return;
                }
                
                $stmt = $pdo->prepare("DELETE FROM item_options WHERE id = ?");
                $stmt->execute([$modifierId]);
                
                echo json_encode(['ok' => true, 'message' => 'Modifier deleted']);
            } catch (Exception $e) {
                error_log("Error deleting modifier: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    }
}

/**
 * Handle modifier image upload (POST /api/modifiers/upload)
 */
function handleModifierImageUpload($pdo) {
    try {
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Не получен файл или ошибка загрузки']);
            return;
        }

        $file = $_FILES['file'];
        $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        $maxSize = 5 * 1024 * 1024; // 5MB

        // Проверка типа файла
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mimeType, $allowedTypes)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Недопустимый тип файла. Разрешены: JPEG, PNG, GIF, WebP']);
            return;
        }

        // Проверка размера
        if ($file['size'] > $maxSize) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Файл слишком большой. Максимум 5MB']);
            return;
        }

        // Определяем расширение
        $originalName = strtolower($file['name']);
        $ext = '.jpg';
        if (strpos($originalName, '.png') !== false) {
            $ext = '.png';
        } elseif (strpos($originalName, '.webp') !== false) {
            $ext = '.webp';
        } elseif (strpos($originalName, '.gif') !== false) {
            $ext = '.gif';
        }

        // Создаем директорию, если её нет
        $uploadDir = __DIR__ . '/../storage/catalog/modifiers-images';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Генерируем уникальное имя файла
        $filename = 'mod_' . time() . '_' . substr(md5(uniqid(rand(), true)), 0, 8) . $ext;
        $targetPath = $uploadDir . '/' . $filename;

        // Перемещаем файл
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Ошибка сохранения файла']);
            return;
        }

        // Возвращаем URL
        $urlPath = '/storage/catalog/modifiers-images/' . $filename;
        echo json_encode(['ok' => true, 'data' => ['url' => $urlPath, 'filename' => $filename]]);
    } catch (Exception $e) {
        error_log("Error uploading modifier image: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Handle modifiers import (POST /api/importModifiers)
 */
function handleImportModifiers($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    try {
        // Ensure base schema exists (including item_options)
        ensureItemOptionsTable($pdo);
        ensureCategoriesSchema($pdo);

        // Ensure image_url column exists for modifier photos
        try {
            $pdo->exec("ALTER TABLE item_options ADD COLUMN image_url TEXT");
        } catch (Exception $e) {
            // Column already exists
        }

        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('File upload error');
        }
        
        $file = $_FILES['file']['tmp_name'];
        $handle = fopen($file, 'r');
        if (!$handle) {
            throw new Exception('Cannot read file');
        }
        
        // Заголовок (для маппинга колонок)
        $headers = fgetcsv($handle);
        if (!$headers) {
            throw new Exception('Invalid CSV format');
        }

        $norm = function($v) {
            $v = trim((string)$v);
            $v = mb_strtolower($v, 'UTF-8');
            $v = preg_replace('/\s+/', ' ', $v);
            return $v;
        };

        $headerMap = [];
        foreach ($headers as $i => $h) {
            $headerMap[$norm($h)] = $i;
        }

        $findIdx = function($candidates) use ($headerMap) {
            foreach ($candidates as $c) {
                $k = mb_strtolower(trim((string)$c), 'UTF-8');
                if (isset($headerMap[$k])) return $headerMap[$k];
            }
            return null;
        };

        // Поддерживаем разные шаблоны заголовков
        $idxName = $findIdx(['option_name', 'name', 'название', 'модификатор', 'доп', 'допы']);
        $idxGroup = $findIdx(['group_name', 'group', 'группа', 'группа модификаторов', 'category_menu', 'category']);
        $idxType = $findIdx(['type', 'тип']);
        $idxPrice = $findIdx(['price_value', 'price', 'цена', 'стоимость']);
        $idxPriceMode = $findIdx(['price_mode', 'mode', 'режим', 'режим цены']);
        $idxImage = $findIdx(['image_url', 'image', 'photo', 'picture', 'url', 'изображение', 'картинка', 'фото']);
        $idxShowInCard = $findIdx(['show_in_product_card', 'show_in_card', 'in_card', 'показывать в карточке', 'показыватьвкарточке']);
        $idxCategoryIds = $findIdx(['category_ids', 'categories', 'категории', 'категория_ids', 'category_id', 'applied_to', 'apply_to', 'apply', 'применять', 'применимо']);
        
        $created = 0;
        $updated = 0;
        $errors = 0;
        $errorMessages = [];
        
        $pdo->beginTransaction();
        
        $normalizeType = function($raw) {
            $t = mb_strtolower(trim((string)$raw), 'UTF-8');
            if ($t === '') return 'switch';
            // Admin template may contain: modifier/service
            if (in_array($t, ['modifier', 'модификатор', 'topping', 'доп', 'допы', 'extra', 'addon', 'add-on'], true)) return 'checkbox';
            if (in_array($t, ['service', 'услуга'], true)) return 'checkbox';
            if (in_array($t, ['switch', 'checkbox', 'quantity', 'group'], true)) return $t;
            return 'checkbox';
        };

        $normalizePriceMode = function($raw) {
            $m = mb_strtolower(trim((string)$raw), 'UTF-8');
            if ($m === '') return 'fixed';
            if (in_array($m, ['fixed', 'руб', 'rur', '₽', 'price'], true)) return 'fixed';
            if (in_array($m, ['percent', '%', 'процент', 'проценты'], true)) return 'percent';
            return 'fixed';
        };

        $findExistingStmt = $pdo->prepare("SELECT id FROM item_options WHERE lower(option_name) = lower(?) AND lower(COALESCE(group_name, '')) = lower(?) LIMIT 1");
        $insertStmt = $pdo->prepare("INSERT INTO item_options (option_name, group_name, type, price_value, price_mode, image_url, is_visible, show_in_product_card, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))");
        $updateStmt = $pdo->prepare("UPDATE item_options SET option_name = ?, group_name = ?, type = ?, price_value = ?, price_mode = ?, image_url = ?, is_visible = ?, show_in_product_card = ?, updated_at = datetime('now') WHERE id = ?");
        $deleteLinksStmt = $pdo->prepare("DELETE FROM item_option_category WHERE item_option_id = ?");
        $insertLinkStmt = $pdo->prepare("INSERT OR IGNORE INTO item_option_category (item_option_id, category_id) VALUES (?, ?)");
        $findCategoryStmt = $pdo->prepare("SELECT id FROM categories WHERE id = ? OR slug = ? OR name = ? LIMIT 1");
        $insertCategoryStmt = $pdo->prepare("INSERT INTO categories (name, slug, parent_id, type, show_on_site, show_in_nav, position) VALUES (?, ?, NULL, 'menu', 1, 1, 0)");

        while (($row = fgetcsv($handle)) !== false) {
            if (!is_array($row) || count($row) === 0) continue;

            $name = trim((string)($idxName !== null ? ($row[$idxName] ?? '') : ($row[0] ?? '')));
            $group = trim((string)($idxGroup !== null ? ($row[$idxGroup] ?? '') : ($row[1] ?? '')));
            $type = $normalizeType($idxType !== null ? ($row[$idxType] ?? '') : ($row[2] ?? 'switch'));
            $price = floatval($idxPrice !== null ? ($row[$idxPrice] ?? 0) : ($row[3] ?? 0));
            $priceMode = $normalizePriceMode($idxPriceMode !== null ? ($row[$idxPriceMode] ?? '') : ($row[4] ?? 'fixed'));
            $imageUrl = $idxImage !== null ? trim((string)($row[$idxImage] ?? '')) : '';
            $showInCardRaw = $idxShowInCard !== null ? trim((string)($row[$idxShowInCard] ?? '')) : '';
            $categoryIdsRaw = $idxCategoryIds !== null ? trim((string)($row[$idxCategoryIds] ?? '')) : '';

            if ($name === '') continue;

            $showInCard = 1;
            if ($showInCardRaw !== '') {
                $v = mb_strtolower($showInCardRaw, 'UTF-8');
                if ($v === '0' || $v === 'false' || $v === 'нет' || $v === 'no' || $v === 'off') {
                    $showInCard = 0;
                }
            }
            
            $groupName = ($group !== '' ? $group : '');
            $findExistingStmt->execute([$name, $groupName]);
            $existingRow = $findExistingStmt->fetch(PDO::FETCH_ASSOC);
            $optId = $existingRow && isset($existingRow['id']) ? intval($existingRow['id']) : null;

            try {
                if ($optId) {
                    $updateStmt->execute([
                        $name,
                        ($group !== '' ? $group : null),
                        $type,
                        $price,
                        $priceMode,
                        ($imageUrl !== '' ? $imageUrl : null),
                        1,
                        $showInCard,
                        $optId
                    ]);
                    $updated++;
                } else {
                    $insertStmt->execute([
                        $name,
                        ($group !== '' ? $group : null),
                        $type,
                        $price,
                        $priceMode,
                        ($imageUrl !== '' ? $imageUrl : null),
                        1,
                        $showInCard,
                        0
                    ]);
                    $optId = intval($pdo->lastInsertId());
                    $created++;
                }
            } catch (Exception $e) {
                $errors++;
                $errorMessages[] = $e->getMessage();
                continue;
            }

            // Re-apply category links
            try {
                if ($optId) {
                    $deleteLinksStmt->execute([$optId]);
                }
            } catch (Exception $e) {
                // ignore
            }

            if ($categoryIdsRaw !== '') {
                $parts = preg_split('/[;\|,\s]+/u', $categoryIdsRaw);
                $parts = array_values(array_filter(array_map('trim', $parts), function($x) { return $x !== ''; }));
                foreach ($parts as $token) {
                    $cid = null;
                    if (preg_match('/^\d+$/', $token)) {
                        $cid = intval($token);
                    } else {
                        $slug = generateSlug($token);
                        $findCategoryStmt->execute([$token, $slug, $token]);
                        $found = $findCategoryStmt->fetch(PDO::FETCH_ASSOC);
                        if ($found && isset($found['id'])) {
                            $cid = intval($found['id']);
                        } else {
                            // autocreate category
                            if ($slug !== '') {
                                try {
                                    $insertCategoryStmt->execute([$token, $slug]);
                                    $cid = intval($pdo->lastInsertId());
                                } catch (Exception $e) {
                                    $cid = null;
                                }
                            }
                        }
                    }
                    if ($cid && $optId) {
                        try {
                            $insertLinkStmt->execute([$optId, $cid]);
                        } catch (Exception $e) {
                            // ignore
                        }
                    }
                }
            }
        }
        
        $pdo->commit();
        if (is_resource($handle)) {
            fclose($handle);
        }
        $handle = null;
        
        echo json_encode(['success' => true, 'created' => $created, 'updated' => $updated, 'errors' => $errors, 'errorMessages' => array_slice($errorMessages, 0, 10)], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("Import modifiers error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function handleSpecialImport($pdo, $type) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }

    if ($type === 'modifiers') {
        // existing handler, but we need to support /api/import/modifiers endpoint
        handleImportModifiers($pdo);
        return;
    }

    try {
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('File upload error');
        }

        $filePath = $_FILES['file']['tmp_name'];
        $handle = fopen($filePath, 'r');
        if (!$handle) {
            throw new Exception('Cannot read file');
        }

        $headers = fgetcsv($handle);
        if (!$headers) {
            throw new Exception('Invalid CSV format');
        }

        $norm = function($v) {
            $v = trim((string)$v);
            $v = mb_strtolower($v, 'UTF-8');
            $v = preg_replace('/\s+/', ' ', $v);
            return $v;
        };

        $headerMap = [];
        foreach ($headers as $i => $h) {
            $headerMap[$norm($h)] = $i;
        }

        $findIdx = function($candidates) use ($headerMap) {
            foreach ($candidates as $c) {
                $k = mb_strtolower(trim((string)$c), 'UTF-8');
                if (isset($headerMap[$k])) return $headerMap[$k];
            }
            return null;
        };

        $created = 0;
        $updated = 0;
        $errors = 0;
        $errorMessages = [];

        if ($type === 'units') {
            $pdo->exec("CREATE TABLE IF NOT EXISTS units (unit_code TEXT PRIMARY KEY, unit_name TEXT NOT NULL, conversion_factor REAL DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_units_name ON units(unit_name)");

            $idxCode = $findIdx(['unit_code', 'code', 'код', 'ед', 'ед.изм', 'едизм']);
            $idxName = $findIdx(['unit_name', 'name', 'название']);
            $idxFactor = $findIdx(['conversion_factor_to_base_unit', 'conversion_factor', 'factor', 'коэффициент', 'coeff']);

            $checkStmt = $pdo->prepare("SELECT 1 FROM units WHERE unit_code = ? LIMIT 1");
            $upsertStmt = $pdo->prepare("INSERT OR REPLACE INTO units (unit_code, unit_name, conversion_factor, updated_at) VALUES (?, ?, ?, datetime('now'))");

            while (($row = fgetcsv($handle)) !== false) {
                if (!is_array($row) || count($row) === 0) continue;
                $code = trim((string)($idxCode !== null ? ($row[$idxCode] ?? '') : ($row[0] ?? '')));
                $name = trim((string)($idxName !== null ? ($row[$idxName] ?? '') : ($row[1] ?? '')));
                $factorRaw = trim((string)($idxFactor !== null ? ($row[$idxFactor] ?? '') : ($row[2] ?? '1')));
                $factorRaw = str_replace(',', '.', $factorRaw);
                $factor = floatval($factorRaw);
                if ($factor <= 0) $factor = 1.0;

                if ($code === '' || $name === '') continue;

                try {
                    $checkStmt->execute([$code]);
                    $exists = (bool)$checkStmt->fetch(PDO::FETCH_ASSOC);
                    $upsertStmt->execute([$code, $name, $factor]);
                    if ($exists) $updated++; else $created++;
                } catch (Exception $e) {
                    $errors++;
                    $errorMessages[] = $e->getMessage();
                }
            }
        } elseif ($type === 'prices') {
            // update products prices by sku or barcode
            try {
                $pdo->exec("ALTER TABLE products ADD COLUMN barcode TEXT");
            } catch (Exception $e) {
                // ignore
            }

            $idxProductCode = $findIdx(['product_code', 'sku', 'code', 'артикул']);
            $idxBarcode = $findIdx(['barcode', 'ean', 'штрихкод']);
            $idxNewPrice = $findIdx(['new_price', 'price', 'цена']);

            $findStmt = $pdo->prepare("SELECT id FROM products WHERE (sku != '' AND sku = ?) OR (barcode != '' AND barcode = ?) LIMIT 1");
            $findBySkuStmt = $pdo->prepare("SELECT id FROM products WHERE (sku != '' AND sku = ?) LIMIT 1");
            $findByNameStmt = $pdo->prepare("SELECT id FROM products WHERE name = ? LIMIT 1");
            $updateStmt = $pdo->prepare("UPDATE products SET price = ? WHERE id = ?");

            while (($row = fgetcsv($handle)) !== false) {
                if (!is_array($row) || count($row) === 0) continue;
                $code = trim((string)($idxProductCode !== null ? ($row[$idxProductCode] ?? '') : ($row[0] ?? '')));
                $barcode = trim((string)($idxBarcode !== null ? ($row[$idxBarcode] ?? '') : ($row[1] ?? '')));
                $newPriceRaw = trim((string)($idxNewPrice !== null ? ($row[$idxNewPrice] ?? '') : ($row[2] ?? '')));
                $newPriceRaw = str_replace(',', '.', $newPriceRaw);
                $newPrice = floatval($newPriceRaw);
                if ($newPrice < 0) continue;

                try {
                    $productId = null;
                    if ($code !== '' || $barcode !== '') {
                        $findStmt->execute([$code, $barcode]);
                        $found = $findStmt->fetch(PDO::FETCH_ASSOC);
                        if ($found && isset($found['id'])) {
                            $productId = intval($found['id']);
                        }
                    }
                    if (!$productId && $code !== '') {
                        $findBySkuStmt->execute([$code]);
                        $found = $findBySkuStmt->fetch(PDO::FETCH_ASSOC);
                        if ($found && isset($found['id'])) $productId = intval($found['id']);
                    }
                    if (!$productId && $code !== '') {
                        $findByNameStmt->execute([$code]);
                        $found = $findByNameStmt->fetch(PDO::FETCH_ASSOC);
                        if ($found && isset($found['id'])) $productId = intval($found['id']);
                    }

                    if (!$productId) {
                        $errors++;
                        $errorMessages[] = "Product not found for code/barcode: {$code} / {$barcode}";
                        continue;
                    }

                    $updateStmt->execute([$newPrice, $productId]);
                    if ($updateStmt->rowCount() > 0) {
                        $updated++;
                    }
                } catch (Exception $e) {
                    $errors++;
                    $errorMessages[] = $e->getMessage();
                }
            }
        } elseif ($type === 'nutrition') {
            // store nutrition values on products
            $ensure = function($name, $typeSql) use ($pdo) {
                try {
                    $pdo->exec("ALTER TABLE products ADD COLUMN {$name} {$typeSql}");
                } catch (Exception $e) {
                    // ignore
                }
            };
            $ensure('energy_kcal', 'REAL');
            $ensure('energy_kj', 'REAL');
            $ensure('proteins', 'REAL');
            $ensure('fats', 'REAL');
            $ensure('carbohydrates', 'REAL');

            $idxName = $findIdx(['name', 'название']);
            $idxSku = $findIdx(['sku', 'product_code', 'code', 'артикул']);
            $idxKcal = $findIdx(['energy_kcal', 'kcal', 'калории']);
            $idxKj = $findIdx(['energy_kj', 'kj', 'кдж']);
            $idxP = $findIdx(['proteins', 'protein', 'белки']);
            $idxF = $findIdx(['fats', 'fat', 'жиры']);
            $idxC = $findIdx(['carbohydrates', 'carbs', 'углеводы']);

            $findBySkuStmt = $pdo->prepare("SELECT id FROM products WHERE (sku != '' AND sku = ?) LIMIT 1");
            $findByNameStmt = $pdo->prepare("SELECT id FROM products WHERE name = ? LIMIT 1");
            $upd = $pdo->prepare("UPDATE products SET energy_kcal = ?, energy_kj = ?, proteins = ?, fats = ?, carbohydrates = ? WHERE id = ?");

            while (($row = fgetcsv($handle)) !== false) {
                if (!is_array($row) || count($row) === 0) continue;
                $name = trim((string)($idxName !== null ? ($row[$idxName] ?? '') : ($row[0] ?? '')));
                $sku = trim((string)($idxSku !== null ? ($row[$idxSku] ?? '') : ($row[1] ?? '')));
                $kcal = str_replace(',', '.', trim((string)($idxKcal !== null ? ($row[$idxKcal] ?? '') : ($row[2] ?? ''))));
                $kj = str_replace(',', '.', trim((string)($idxKj !== null ? ($row[$idxKj] ?? '') : ($row[3] ?? ''))));
                $p = str_replace(',', '.', trim((string)($idxP !== null ? ($row[$idxP] ?? '') : ($row[4] ?? ''))));
                $f = str_replace(',', '.', trim((string)($idxF !== null ? ($row[$idxF] ?? '') : ($row[5] ?? ''))));
                $c = str_replace(',', '.', trim((string)($idxC !== null ? ($row[$idxC] ?? '') : ($row[6] ?? ''))));

                $kcalV = ($kcal !== '' ? floatval($kcal) : null);
                $kjV = ($kj !== '' ? floatval($kj) : null);
                $pV = ($p !== '' ? floatval($p) : null);
                $fV = ($f !== '' ? floatval($f) : null);
                $cV = ($c !== '' ? floatval($c) : null);

                try {
                    $productId = null;
                    if ($sku !== '') {
                        $findBySkuStmt->execute([$sku]);
                        $found = $findBySkuStmt->fetch(PDO::FETCH_ASSOC);
                        if ($found && isset($found['id'])) $productId = intval($found['id']);
                    }
                    if (!$productId && $name !== '') {
                        $findByNameStmt->execute([$name]);
                        $found = $findByNameStmt->fetch(PDO::FETCH_ASSOC);
                        if ($found && isset($found['id'])) $productId = intval($found['id']);
                    }

                    if (!$productId) {
                        $errors++;
                        $errorMessages[] = "Product not found for nutrition: {$name} / {$sku}";
                        continue;
                    }

                    $upd->execute([$kcalV, $kjV, $pV, $fV, $cV, $productId]);
                    if ($upd->rowCount() > 0) {
                        $updated++;
                    }
                } catch (Exception $e) {
                    $errors++;
                    $errorMessages[] = $e->getMessage();
                }
            }
        } else {
            throw new Exception('Unknown import type');
        }

        if (is_resource($handle)) {
            fclose($handle);
        }
        $handle = null;

        echo json_encode([
            'success' => true,
            'created' => $created,
            'updated' => $updated,
            'errors' => $errors,
            'errorMessages' => array_slice($errorMessages, 0, 10)
        ], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
}

function getAccountByType($pdo, $type) {
    // Правила по умолчанию
    $defaultAccounts = [
        'product' => '41.01',
        'ingredient' => '10.01',
        'dish' => '41.01',
        'semi_product' => '10.01',
        'modifier' => '41.01'
    ];
    
    $typeMap = [
        'товар' => 'product',
        'материал' => 'ingredient',
        'блюдо' => 'dish',
        'заготовка' => 'semi_product',
        'модификатор' => 'modifier'
    ];
    
    $normalizedType = $typeMap[strtolower($type)] ?? $type;
    return $defaultAccounts[$normalizedType] ?? '41.01';
}

/**
 * Handle image import from ZIP or CSV (POST /api/importImages)
 */
function handleImportImages($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    try {
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'File upload failed']);
            return;
        }
        
        $file = $_FILES['file'];
        $importType = $_POST['type'] ?? 'images_zip';
        $fileExtension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        
        $imported = 0;
        $errors = [];
        
        if ($importType === 'images_zip' && $fileExtension === 'zip') {
            // Обработка ZIP архива
            if (!class_exists('ZipArchive')) {
                throw new Exception('Расширение ZipArchive не установлено на сервере');
            }
            
            $zip = new ZipArchive();
            if ($zip->open($file['tmp_name']) === TRUE) {
                $uploadDir = __DIR__ . '/../uploads/products/';
                if (!file_exists($uploadDir)) {
                    mkdir($uploadDir, 0777, true);
                }
                
                $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
                $notFound = [];
                $skipped = [];
                
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $filename = $zip->getNameIndex($i);
                    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                    
                    if (!in_array($ext, $allowedExtensions)) {
                        $skipped[] = $filename . " (неподдерживаемый формат: $ext)";
                        continue;
                    }
                    
                    // Извлекаем имя файла без пути
                    $basename = basename($filename);
                    // Убираем расширение для поиска товара
                    $productIdentifier = pathinfo($basename, PATHINFO_FILENAME);
                    
                    // Ищем товар по SKU, названию, external_id или штрихкоду
                    // Сначала пробуем точное совпадение по SKU
                    $stmt = $pdo->prepare("SELECT id, name, sku FROM products WHERE sku = ? LIMIT 1");
                    $stmt->execute([$productIdentifier]);
                    $product = $stmt->fetch(PDO::FETCH_ASSOC);
                    
                    // Если не найдено, пробуем по названию (частичное совпадение)
                    if (!$product) {
                        $stmt = $pdo->prepare("SELECT id, name, sku FROM products WHERE name LIKE ? OR name = ? LIMIT 1");
                        $stmt->execute(["%$productIdentifier%", $productIdentifier]);
                        $product = $stmt->fetch(PDO::FETCH_ASSOC);
                    }
                    
                    // Если не найдено, пробуем по штрихкоду (если есть колонка barcode)
                    if (!$product) {
                        try {
                            $stmt = $pdo->prepare("SELECT id, name, sku FROM products WHERE barcode = ? LIMIT 1");
                            $stmt->execute([$productIdentifier]);
                            $product = $stmt->fetch(PDO::FETCH_ASSOC);
                        } catch (Exception $e) {
                            // Колонка barcode может отсутствовать в старых версиях БД
                        }
                    }
                    
                    if ($product) {
                        // Извлекаем файл
                        $fileContent = $zip->getFromIndex($i);
                        if ($fileContent === false) {
                            $errors[] = "Не удалось извлечь файл из архива: $basename";
                            continue;
                        }
                        
                        $newFilename = 'product_' . $product['id'] . '_' . time() . '_' . $basename;
                        $filePath = $uploadDir . $newFilename;
                        
                        if (file_put_contents($filePath, $fileContent)) {
                            $imageUrl = '/uploads/products/' . $newFilename;
                            
                            // Обновляем товар
                            $updateStmt = $pdo->prepare("UPDATE products SET image_url = ? WHERE id = ?");
                            $updateStmt->execute([$imageUrl, $product['id']]);
                            $imported++;
                        } else {
                            $errors[] = "Не удалось сохранить файл на диск: $basename (проверьте права доступа к папке uploads/products/)";
                        }
                    } else {
                        $notFound[] = $basename . " (товар не найден по идентификатору: $productIdentifier)";
                    }
                }
                
                // Добавляем информацию о не найденных товарах
                if (count($notFound) > 0) {
                    $errors[] = "Товары не найдены для " . count($notFound) . " изображений. Убедитесь, что:";
                    $errors[] = "1. Товары уже импортированы в систему";
                    $errors[] = "2. Имена файлов совпадают с SKU или названием товара";
                    $errors[] = "3. Примеры правильных имен: PIZZA-001.jpg, Пицца Маргарита.jpg";
                    if (count($notFound) <= 10) {
                        $errors = array_merge($errors, array_slice($notFound, 0, 10));
                    } else {
                        $errors[] = "Первые 10 не найденных файлов: " . implode(", ", array_slice($notFound, 0, 10));
                    }
                }
                
                if (count($skipped) > 0 && count($skipped) <= 5) {
                    $errors[] = "Пропущено файлов с неподдерживаемыми форматами: " . count($skipped);
                }
                
                $zip->close();
            } else {
                throw new Exception('Не удалось открыть ZIP архив');
            }
        } elseif ($importType === 'images_csv' && in_array($fileExtension, ['csv', 'xlsx', 'xls'])) {
            // Обработка CSV с URL изображений
            $content = file_get_contents($file['tmp_name']);
            $rows = parseCSVContent($content);
            
            foreach ($rows as $row) {
                $productCode = trim($row['product_code'] ?? $row['name'] ?? $row['sku'] ?? '');
                $imageUrl = trim($row['image_url'] ?? $row['url'] ?? '');
                
                if (empty($productCode) || empty($imageUrl)) {
                    continue;
                }
                
                // Ищем товар
                $stmt = $pdo->prepare("SELECT id FROM products WHERE sku = ? OR name = ? LIMIT 1");
                $stmt->execute([$productCode, $productCode]);
                $product = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($product) {
                    $updateStmt = $pdo->prepare("UPDATE products SET image_url = ? WHERE id = ?");
                    $updateStmt->execute([$imageUrl, $product['id']]);
                    $imported++;
                }
            }
        } else {
            throw new Exception('Неподдерживаемый формат файла');
        }
        
        $message = "Импорт завершен. Импортировано изображений: $imported";
        if (count($errors) > 0) {
            $message .= ". Ошибок: " . count($errors);
        }
        
        echo json_encode([
            'success' => true,
            'ok' => true,
            'message' => $message,
            'imported' => $imported,
            'errors' => count($errors),
            'errorMessages' => array_slice($errors, 0, 20), // Увеличиваем до 20 для более подробной информации
            'warnings' => count($errors) > 0 ? "Некоторые изображения не были импортированы. Проверьте список ошибок ниже." : null
        ]);
        
    } catch (Exception $e) {
        error_log("Image import error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleIntegrationsJobs() {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'POST';
    
    try {
        if ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['job'])) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Invalid job data']);
                return;
            }
            
            $jobType = $input['job']; // 'sync', 'export', 'import'
            $integration = $input['integration'] ?? 'all'; // 'onec', 'rkeeper', 'kontur', 'all'
            $jobId = 'job_' . time() . '_' . mt_rand(1000, 9999);
            
            // TODO: Реальный запуск job'ов через очередь
            // Пока возвращаем успешный ответ
            $result = [
                'jobId' => $jobId,
                'jobType' => $jobType,
                'integration' => $integration,
                'status' => 'queued',
                'createdAt' => date('c'),
                'message' => 'Job queued successfully'
            ];
            
            // Записываем job в очередь (для будущей обработки Worker'ом)
            $jobsFile = __DIR__ . '/../storage/integrations/jobs.jsonl';
            $jobsDir = dirname($jobsFile);
            if (!is_dir($jobsDir)) {
                mkdir($jobsDir, 0755, true);
            }
            
            file_put_contents($jobsFile, json_encode($result, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND);
            
            echo json_encode(['ok' => true, 'data' => $result]);
        } elseif ($method === 'GET') {
            // Получаем список job'ов
            $jobsFile = __DIR__ . '/../storage/integrations/jobs.jsonl';
            $jobs = [];
            
            if (file_exists($jobsFile)) {
                $content = file_get_contents($jobsFile);
                if (!empty(trim($content))) {
                    $lines = explode("\n", trim($content));
                    for ($i = count($lines) - 1; $i >= 0 && count($jobs) < 50; $i--) {
                        $line = trim($lines[$i]);
                        if (empty($line)) continue;
                        try {
                            $job = json_decode($line, true);
                            if ($job) {
                                $jobs[] = $job;
                            }
                        } catch (Exception $e) {
                            // Пропускаем некорректные строки
                        }
                    }
                }
            }
            
            echo json_encode(['ok' => true, 'data' => array_reverse($jobs)]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}

function handleIntegrationsEvents() {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    
    try {
        if ($method === 'GET') {
            // Получаем события интеграций (последние из integration bus)
            $events = getInventoryEvents(50); // Используем существующую функцию
            echo json_encode(['ok' => true, 'data' => $events]);
        } else {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}
?>

