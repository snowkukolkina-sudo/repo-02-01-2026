<?php
/**
 * Скрипт для исправления проблем с данными:
 * 1. Привязка товаров к категориям
 * 2. Создание техкарт для блюд без техкарт
 * 3. Проверка данных в складе
 */

// Подключение к базе данных (используем тот же путь, что и в index.php)
function getDatabaseConnection() {
    $dbPath = __DIR__ . '/database.sqlite';
    if (!file_exists($dbPath)) {
        $dbPath = __DIR__ . '/../database.sqlite';
    }
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA foreign_keys = ON');
    return $pdo;
}

function fixDataIssues($pdo) {
    $results = [
        'categories' => ['fixed' => 0, 'total' => 0],
        'recipes' => ['created' => 0, 'total_dishes' => 0],
        'warehouse' => ['checked' => 0, 'fixed' => 0]
    ];
    
    try {
        $pdo->beginTransaction();
        
        // 1. ПРИВЯЗКА ТОВАРОВ К КАТЕГОРИЯМ
        echo "=== 1. Проверка связей товаров с категориями ===\n";
        
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
            echo "Создана таблица product_category\n";
        }
        
        // Получаем все товары без категорий
        $productsWithoutCategories = $pdo->query("
            SELECT p.id, p.name, p.category
            FROM products p
            LEFT JOIN product_category pc ON p.id = pc.product_id
            WHERE pc.product_id IS NULL
        ")->fetchAll(PDO::FETCH_ASSOC);
        
        $results['categories']['total'] = count($productsWithoutCategories);
        echo "Найдено товаров без категорий: " . count($productsWithoutCategories) . "\n";
        
        // Получаем или создаем категорию "Другое"
        $defaultCategory = $pdo->query("SELECT id FROM categories WHERE name = 'Другое' OR slug = 'other' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
        
        if (!$defaultCategory) {
            // Создаем категорию "Другое"
            $stmt = $pdo->prepare("INSERT INTO categories (name, slug, type, show_on_site, show_in_nav) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute(['Другое', 'other', 'menu', 1, 0]);
            $defaultCategoryId = $pdo->lastInsertId();
            echo "Создана категория 'Другое' (ID: $defaultCategoryId)\n";
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
        
        echo "Привязано товаров к категории 'Другое': {$results['categories']['fixed']}\n";
        
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
        
        echo "Всего привязано товаров к категориям: {$results['categories']['fixed']}\n\n";
        
        // 2. СОЗДАНИЕ ТЕХКАРТ ДЛЯ БЛЮД БЕЗ ТЕХКАРТ
        echo "=== 2. Проверка техкарт для блюд ===\n";
        
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
            $pdo->exec("ALTER TABLE recipes ADD COLUMN product_id INTEGER");
            echo "Добавлена колонка product_id в таблицу recipes\n";
        }
        
        // Получаем все блюда (type='dish') без техкарт
        $dishesWithoutRecipes = $pdo->query("
            SELECT p.id, p.name, p.price, p.cost, p.description
            FROM products p
            LEFT JOIN recipes r ON p.id = r.product_id
            WHERE p.type = 'dish' AND r.id IS NULL
        ")->fetchAll(PDO::FETCH_ASSOC);
        
        $results['recipes']['total_dishes'] = count($dishesWithoutRecipes);
        echo "Найдено блюд без техкарт: " . count($dishesWithoutRecipes) . "\n";
        
        // Создаем базовые техкарты для блюд
        $recipeStmt = $pdo->prepare("
            INSERT INTO recipes (name, product_id, output_quantity, output_unit, cooking_time, ingredients, cost, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        foreach ($dishesWithoutRecipes as $dish) {
            try {
                $recipeStmt->execute([
                    $dish['name'],
                    $dish['id'],
                    1, // Выход: 1 порция
                    'шт', // Единица измерения
                    30, // Время приготовления: 30 минут
                    json_encode([]), // Пустой список ингредиентов (нужно будет заполнить вручную)
                    floatval($dish['cost'] ?? 0), // Себестоимость из товара
                    1 // Активна
                ]);
                $results['recipes']['created']++;
            } catch (Exception $e) {
                error_log("Ошибка создания техкарты для блюда {$dish['id']}: " . $e->getMessage());
            }
        }
        
        echo "Создано техкарт: {$results['recipes']['created']}\n\n";
        
        // 3. ПРОВЕРКА ДАННЫХ В СКЛАДЕ
        echo "=== 3. Проверка данных в складе ===\n";
        
        // Проверяем наличие таблицы inventory_balances
        $tableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_balances'")->fetch();
        if (!$tableCheck) {
            echo "Таблица inventory_balances не найдена, пропускаем проверку склада\n";
        } else {
            // Получаем все записи с проблемами (NULL или пустые значения)
            $problematicBalances = $pdo->query("
                SELECT ib.id, ib.product_id, ib.quantity, ib.warehouse_id
                FROM inventory_balances ib
                LEFT JOIN products p ON ib.product_id = p.id
                WHERE p.id IS NULL OR ib.quantity IS NULL
            ")->fetchAll(PDO::FETCH_ASSOC);
            
            $results['warehouse']['checked'] = $pdo->query("SELECT COUNT(*) FROM inventory_balances")->fetchColumn();
            echo "Проверено записей на складе: {$results['warehouse']['checked']}\n";
            echo "Найдено проблемных записей: " . count($problematicBalances) . "\n";
            
            // Удаляем записи с несуществующими товарами
            $deleteStmt = $pdo->prepare("DELETE FROM inventory_balances WHERE product_id NOT IN (SELECT id FROM products)");
            $deleteStmt->execute();
            $deleted = $deleteStmt->rowCount();
            
            // Устанавливаем 0 для NULL количеств
            $updateStmt = $pdo->prepare("UPDATE inventory_balances SET quantity = 0 WHERE quantity IS NULL");
            $updateStmt->execute();
            $updated = $updateStmt->rowCount();
            
            $results['warehouse']['fixed'] = $deleted + $updated;
            echo "Исправлено записей: {$results['warehouse']['fixed']} (удалено: $deleted, обновлено: $updated)\n\n";
        }
        
        $pdo->commit();
        
        echo "=== РЕЗУЛЬТАТЫ ===\n";
        echo "Категории: привязано {$results['categories']['fixed']} из {$results['categories']['total']} товаров\n";
        echo "Техкарты: создано {$results['recipes']['created']} из {$results['recipes']['total_dishes']} блюд\n";
        echo "Склад: исправлено {$results['warehouse']['fixed']} из {$results['warehouse']['checked']} записей\n";
        
        return $results;
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("Ошибка при исправлении данных: " . $e->getMessage());
        throw $e;
    }
}

// Этот файл не должен выполняться напрямую, только через handleFixDataIssues в index.php

