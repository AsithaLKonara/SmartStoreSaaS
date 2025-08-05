<?php
/**
 * Plugin Name: SmartStore WooCommerce Integration
 * Plugin URI: https://smartstore.ai
 * Description: Real-time synchronization between WooCommerce and SmartStore AI platform
 * Version: 1.0.0
 * Author: SmartStore AI
 * License: GPL v2 or later
 * Text Domain: smartstore-woocommerce
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class SmartStoreWooCommerce {
    private $api_url;
    private $api_key;
    private $organization_id;
    private $webhook_secret;

    public function __construct() {
        $this->api_url = get_option('smartstore_api_url', '');
        $this->api_key = get_option('smartstore_api_key', '');
        $this->organization_id = get_option('smartstore_organization_id', '');
        $this->webhook_secret = get_option('smartstore_webhook_secret', '');

        add_action('init', array($this, 'init'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'admin_init'));
        
        // WooCommerce hooks
        add_action('woocommerce_new_product', array($this, 'sync_product_created'));
        add_action('woocommerce_update_product', array($this, 'sync_product_updated'));
        add_action('woocommerce_delete_product', array($this, 'sync_product_deleted'));
        add_action('woocommerce_new_order', array($this, 'sync_order_created'));
        add_action('woocommerce_order_status_changed', array($this, 'sync_order_updated'));
        
        // Webhook endpoint
        add_action('rest_api_init', array($this, 'register_webhook_endpoint'));
    }

    public function init() {
        load_plugin_textdomain('smartstore-woocommerce', false, dirname(plugin_basename(__FILE__)) . '/languages');
    }

    public function add_admin_menu() {
        add_menu_page(
            'SmartStore Integration',
            'SmartStore',
            'manage_options',
            'smartstore-woocommerce',
            array($this, 'admin_page'),
            'dashicons-store',
            56
        );
    }

    public function admin_init() {
        register_setting('smartstore_options', 'smartstore_api_url');
        register_setting('smartstore_options', 'smartstore_api_key');
        register_setting('smartstore_options', 'smartstore_organization_id');
        register_setting('smartstore_options', 'smartstore_webhook_secret');
        register_setting('smartstore_options', 'smartstore_auto_sync', array('type' => 'boolean'));
        register_setting('smartstore_options', 'smartstore_sync_products', array('type' => 'boolean'));
        register_setting('smartstore_options', 'smartstore_sync_orders', array('type' => 'boolean'));
    }

    public function admin_page() {
        ?>
        <div class="wrap">
            <h1><?php _e('SmartStore WooCommerce Integration', 'smartstore-woocommerce'); ?></h1>
            
            <form method="post" action="options.php">
                <?php settings_fields('smartstore_options'); ?>
                <?php do_settings_sections('smartstore_options'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php _e('SmartStore API URL', 'smartstore-woocommerce'); ?></th>
                        <td>
                            <input type="url" name="smartstore_api_url" value="<?php echo esc_attr($this->api_url); ?>" class="regular-text" />
                            <p class="description"><?php _e('Your SmartStore platform API URL', 'smartstore-woocommerce'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('API Key', 'smartstore-woocommerce'); ?></th>
                        <td>
                            <input type="text" name="smartstore_api_key" value="<?php echo esc_attr($this->api_key); ?>" class="regular-text" />
                            <p class="description"><?php _e('Your SmartStore API key', 'smartstore-woocommerce'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Organization ID', 'smartstore-woocommerce'); ?></th>
                        <td>
                            <input type="text" name="smartstore_organization_id" value="<?php echo esc_attr($this->organization_id); ?>" class="regular-text" />
                            <p class="description"><?php _e('Your SmartStore organization ID', 'smartstore-woocommerce'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Webhook Secret', 'smartstore-woocommerce'); ?></th>
                        <td>
                            <input type="text" name="smartstore_webhook_secret" value="<?php echo esc_attr($this->webhook_secret); ?>" class="regular-text" />
                            <p class="description"><?php _e('Secret key for webhook verification', 'smartstore-woocommerce'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Auto Sync', 'smartstore-woocommerce'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="smartstore_auto_sync" value="1" <?php checked(get_option('smartstore_auto_sync', true)); ?> />
                                <?php _e('Automatically sync changes to SmartStore', 'smartstore-woocommerce'); ?>
                            </label>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Sync Products', 'smartstore-woocommerce'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="smartstore_sync_products" value="1" <?php checked(get_option('smartstore_sync_products', true)); ?> />
                                <?php _e('Sync product changes', 'smartstore-woocommerce'); ?>
                            </label>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Sync Orders', 'smartstore-woocommerce'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="smartstore_sync_orders" value="1" <?php checked(get_option('smartstore_sync_orders', true)); ?> />
                                <?php _e('Sync order changes', 'smartstore-woocommerce'); ?>
                            </label>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button(); ?>
            </form>
            
            <hr>
            
            <h2><?php _e('Manual Sync', 'smartstore-woocommerce'); ?></h2>
            <p><?php _e('Use these buttons to manually sync data with SmartStore:', 'smartstore-woocommerce'); ?></p>
            
            <p>
                <button type="button" class="button button-primary" onclick="syncProducts()">
                    <?php _e('Sync All Products', 'smartstore-woocommerce'); ?>
                </button>
                
                <button type="button" class="button button-primary" onclick="syncOrders()">
                    <?php _e('Sync All Orders', 'smartstore-woocommerce'); ?>
                </button>
                
                <button type="button" class="button button-secondary" onclick="testConnection()">
                    <?php _e('Test Connection', 'smartstore-woocommerce'); ?>
                </button>
            </p>
            
            <div id="sync-status"></div>
        </div>
        
        <script>
        function syncProducts() {
            jQuery.post(ajaxurl, {
                action: 'smartstore_sync_products',
                nonce: '<?php echo wp_create_nonce('smartstore_sync'); ?>'
            }, function(response) {
                jQuery('#sync-status').html('<div class="notice notice-success"><p>' + response.data + '</p></div>');
            });
        }
        
        function syncOrders() {
            jQuery.post(ajaxurl, {
                action: 'smartstore_sync_orders',
                nonce: '<?php echo wp_create_nonce('smartstore_sync'); ?>'
            }, function(response) {
                jQuery('#sync-status').html('<div class="notice notice-success"><p>' + response.data + '</p></div>');
            });
        }
        
        function testConnection() {
            jQuery.post(ajaxurl, {
                action: 'smartstore_test_connection',
                nonce: '<?php echo wp_create_nonce('smartstore_sync'); ?>'
            }, function(response) {
                if (response.success) {
                    jQuery('#sync-status').html('<div class="notice notice-success"><p>' + response.data + '</p></div>');
                } else {
                    jQuery('#sync-status').html('<div class="notice notice-error"><p>' + response.data + '</p></div>');
                }
            });
        }
        </script>
        <?php
    }

    public function register_webhook_endpoint() {
        register_rest_route('smartstore/v1', '/webhook/(?P<organization_id>[a-zA-Z0-9]+)', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_webhook'),
            'permission_callback' => array($this, 'verify_webhook'),
        ));
    }

    public function verify_webhook($request) {
        $signature = $request->get_header('x-smartstore-signature');
        $payload = $request->get_body();
        
        if (!$signature || !$this->webhook_secret) {
            return false;
        }
        
        $expected_signature = hash_hmac('sha256', $payload, $this->webhook_secret);
        return hash_equals($expected_signature, $signature);
    }

    public function handle_webhook($request) {
        $organization_id = $request->get_param('organization_id');
        $body = $request->get_json_params();
        
        if ($organization_id !== $this->organization_id) {
            return new WP_Error('invalid_organization', 'Invalid organization ID', array('status' => 400));
        }
        
        $type = $body['type'] ?? '';
        $action = $body['action'] ?? '';
        $data = $body['data'] ?? array();
        
        switch ($type) {
            case 'product':
                $this->handle_product_webhook($action, $data);
                break;
            case 'order':
                $this->handle_order_webhook($action, $data);
                break;
            case 'inventory':
                $this->handle_inventory_webhook($action, $data);
                break;
        }
        
        return new WP_REST_Response(array('status' => 'ok'), 200);
    }

    private function handle_product_webhook($action, $data) {
        if (!get_option('smartstore_sync_products', true)) {
            return;
        }
        
        switch ($action) {
            case 'create':
            case 'update':
                $this->update_woocommerce_product($data);
                break;
            case 'delete':
                $this->delete_woocommerce_product($data);
                break;
        }
    }

    private function handle_order_webhook($action, $data) {
        if (!get_option('smartstore_sync_orders', true)) {
            return;
        }
        
        switch ($action) {
            case 'create':
            case 'update':
                $this->update_woocommerce_order($data);
                break;
        }
    }

    private function handle_inventory_webhook($action, $data) {
        if ($action === 'update' && isset($data['productId'], $data['quantity'])) {
            $product_id = wc_get_product_id_by_sku($data['productId']);
            if ($product_id) {
                $product = wc_get_product($product_id);
                if ($product) {
                    $product->set_stock_quantity($data['quantity']);
                    $product->save();
                }
            }
        }
    }

    public function sync_product_created($product_id) {
        if (!get_option('smartstore_auto_sync', true) || !get_option('smartstore_sync_products', true)) {
            return;
        }
        
        $this->send_product_webhook('create', $product_id);
    }

    public function sync_product_updated($product_id) {
        if (!get_option('smartstore_auto_sync', true) || !get_option('smartstore_sync_products', true)) {
            return;
        }
        
        $this->send_product_webhook('update', $product_id);
    }

    public function sync_product_deleted($product_id) {
        if (!get_option('smartstore_auto_sync', true) || !get_option('smartstore_sync_products', true)) {
            return;
        }
        
        $this->send_product_webhook('delete', $product_id);
    }

    public function sync_order_created($order_id) {
        if (!get_option('smartstore_auto_sync', true) || !get_option('smartstore_sync_orders', true)) {
            return;
        }
        
        $this->send_order_webhook('create', $order_id);
    }

    public function sync_order_updated($order_id, $old_status, $new_status) {
        if (!get_option('smartstore_auto_sync', true) || !get_option('smartstore_sync_orders', true)) {
            return;
        }
        
        $this->send_order_webhook('update', $order_id);
    }

    private function send_product_webhook($action, $product_id) {
        $product = wc_get_product($product_id);
        if (!$product) {
            return;
        }
        
        $data = array(
            'id' => $product_id,
            'name' => $product->get_name(),
            'description' => $product->get_description(),
            'short_description' => $product->get_short_description(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'stock_quantity' => $product->get_stock_quantity(),
            'stock_status' => $product->get_stock_status(),
            'status' => $product->get_status(),
            'sku' => $product->get_sku(),
            'images' => $this->get_product_images($product),
            'categories' => $this->get_product_categories($product)
        );
        
        $this->send_webhook('product', $action, $data);
    }

    private function send_order_webhook($action, $order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }
        
        $data = array(
            'id' => $order_id,
            'number' => $order->get_order_number(),
            'status' => $order->get_status(),
            'total' => $order->get_total(),
            'subtotal' => $order->get_subtotal(),
            'customer_id' => $order->get_customer_id(),
            'billing' => $order->get_address('billing'),
            'shipping' => $order->get_address('shipping'),
            'line_items' => $this->get_order_items($order),
            'date_created' => $order->get_date_created()->format('c'),
            'date_modified' => $order->get_date_modified()->format('c')
        );
        
        $this->send_webhook('order', $action, $data);
    }

    private function send_webhook($type, $action, $data) {
        if (!$this->api_url || !$this->organization_id) {
            return;
        }
        
        $payload = array(
            'type' => $type,
            'action' => $action,
            'data' => $data,
            'timestamp' => current_time('c'),
            'source' => 'woocommerce'
        );
        
        $signature = hash_hmac('sha256', json_encode($payload), $this->webhook_secret);
        
        wp_remote_post($this->api_url . '/api/webhooks/woocommerce/' . $this->organization_id, array(
            'headers' => array(
                'Content-Type' => 'application/json',
                'x-smartstore-signature' => $signature
            ),
            'body' => json_encode($payload),
            'timeout' => 30
        ));
    }

    private function get_product_images($product) {
        $images = array();
        $attachment_ids = $product->get_gallery_image_ids();
        
        if ($product->get_image_id()) {
            array_unshift($attachment_ids, $product->get_image_id());
        }
        
        foreach ($attachment_ids as $attachment_id) {
            $images[] = array(
                'src' => wp_get_attachment_url($attachment_id),
                'alt' => get_post_meta($attachment_id, '_wp_attachment_image_alt', true)
            );
        }
        
        return $images;
    }

    private function get_product_categories($product) {
        $categories = array();
        $terms = get_the_terms($product->get_id(), 'product_cat');
        
        if ($terms && !is_wp_error($terms)) {
            foreach ($terms as $term) {
                $categories[] = array(
                    'id' => $term->term_id,
                    'name' => $term->name
                );
            }
        }
        
        return $categories;
    }

    private function get_order_items($order) {
        $items = array();
        
        foreach ($order->get_items() as $item) {
            $items[] = array(
                'id' => $item->get_id(),
                'name' => $item->get_name(),
                'product_id' => $item->get_product_id(),
                'variation_id' => $item->get_variation_id(),
                'quantity' => $item->get_quantity(),
                'total' => $item->get_total(),
                'subtotal' => $item->get_subtotal()
            );
        }
        
        return $items;
    }

    private function update_woocommerce_product($data) {
        $product_id = $data['wooCommerceId'] ?? null;
        
        if (!$product_id) {
            return;
        }
        
        $product = wc_get_product($product_id);
        if (!$product) {
            return;
        }
        
        if (isset($data['name'])) {
            $product->set_name($data['name']);
        }
        
        if (isset($data['description'])) {
            $product->set_description($data['description']);
        }
        
        if (isset($data['price'])) {
            $product->set_price($data['price']);
        }
        
        if (isset($data['stockQuantity'])) {
            $product->set_stock_quantity($data['stockQuantity']);
        }
        
        if (isset($data['isActive'])) {
            $product->set_status($data['isActive'] ? 'publish' : 'draft');
        }
        
        $product->save();
    }

    private function delete_woocommerce_product($data) {
        $product_id = $data['wooCommerceId'] ?? null;
        
        if ($product_id) {
            wp_delete_post($product_id, true);
        }
    }

    private function update_woocommerce_order($data) {
        $order_id = $data['wooCommerceId'] ?? null;
        
        if (!$order_id) {
            return;
        }
        
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }
        
        if (isset($data['status'])) {
            $order->update_status($data['status']);
        }
        
        if (isset($data['totalAmount'])) {
            $order->set_total($data['totalAmount']);
        }
        
        $order->save();
    }
}

// Initialize the plugin
new SmartStoreWooCommerce();

// AJAX handlers
add_action('wp_ajax_smartstore_sync_products', function() {
    check_ajax_referer('smartstore_sync', 'nonce');
    
    $products = wc_get_products(array('limit' => -1));
    $count = 0;
    
    foreach ($products as $product) {
        do_action('woocommerce_update_product', $product->get_id());
        $count++;
    }
    
    wp_send_json_success(sprintf(__('Synced %d products', 'smartstore-woocommerce'), $count));
});

add_action('wp_ajax_smartstore_sync_orders', function() {
    check_ajax_referer('smartstore_sync', 'nonce');
    
    $orders = wc_get_orders(array('limit' => -1));
    $count = 0;
    
    foreach ($orders as $order) {
        do_action('woocommerce_order_status_changed', $order->get_id(), '', $order->get_status());
        $count++;
    }
    
    wp_send_json_success(sprintf(__('Synced %d orders', 'smartstore-woocommerce'), $count));
});

add_action('wp_ajax_smartstore_test_connection', function() {
    check_ajax_referer('smartstore_sync', 'nonce');
    
    $api_url = get_option('smartstore_api_url');
    $api_key = get_option('smartstore_api_key');
    
    if (!$api_url || !$api_key) {
        wp_send_json_error(__('API URL and API Key are required', 'smartstore-woocommerce'));
    }
    
    $response = wp_remote_get($api_url . '/api/health', array(
        'headers' => array('Authorization' => 'Bearer ' . $api_key),
        'timeout' => 10
    ));
    
    if (is_wp_error($response)) {
        wp_send_json_error(__('Connection failed: ', 'smartstore-woocommerce') . $response->get_error_message());
    }
    
    $status_code = wp_remote_retrieve_response_code($response);
    if ($status_code === 200) {
        wp_send_json_success(__('Connection successful!', 'smartstore-woocommerce'));
    } else {
        wp_send_json_error(__('Connection failed with status code: ', 'smartstore-woocommerce') . $status_code);
    }
});
?> 