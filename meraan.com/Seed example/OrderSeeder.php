<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Order;
use App\Helpers\QrHelper;
use Faker\Factory as Faker;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use App\Models\EventCategory;
use Illuminate\Database\Seeder;
use App\Helpers\GeneratorHelper;
use App\Models\CategoryOrder;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class OrderSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');

        Order::truncate();
        Transaction::truncate();
        CategoryOrder::truncate();

        $this->rrmdir(storage_path("app/public/public/qr-codes"));

        $path = storage_path("app/public/public/qr-codes");

        if (!File::isDirectory($path)) {
            File::makeDirectory($path, 0777, true, true);
        }

        $user = User::where('role_id', 1)->inRandomOrder()->pluck('id')->toArray();

        for ($loopOrdersNumber = 0; $loopOrdersNumber < 0.5 * count($user); $loopOrdersNumber++) {

            $order_id = GeneratorHelper::generateCode(
                1000000,
                9999999,
                'order_id',
                'orders'
            );

            $order = Order::create([
                'user_id'     => $user[$loopOrdersNumber],
                'order_id'    => $order_id,
                'quantity'    => null,
                'discount_id' => null,
                'status'      => 'paid',
                'total_price' => null,
            ]);

            $order->transaction()->create([
                'transaction_id' => strtoupper(Str::random(2)) . ($order_id + 10 * 10000000000),

            ]);

            $catRandom = EventCategory::inRandomOrder()->pluck('id')->toArray();

            for ($i = 0; $i < rand(1, 3); $i++) {


                $ticket_number = GeneratorHelper::generateCode(
                    1000000,
                    9999999,
                    'ticket_number',
                    'category_orders'
                );

                $qrUrl = QrHelper::moveToStorage($ticket_number);

                $order->categoryOrder()->create([
                    'order_id'          => $order->id,
                    'event_category_id' => $catRandom[$i],
                    'category_name'     => EventCategory::find($catRandom[$i])->name,
                    'event_name'        => EventCategory::find($catRandom[$i])->events->event_name,
                    'currency'          => 'usd',
                    'ticket_number'     => $ticket_number,
                    'gift'              => 0,
                    'qr_code'           => $qrUrl,
                    'final_price'       => EventCategory::find($catRandom[$i])->fees,
                ]);
            }
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }

    private function rrmdir(string $dir): void
    {
        if (is_dir($dir)) {
            $objects = scandir($dir);
            foreach ($objects as $object) {
                if ($object != "." && $object != "..") {
                    if (is_dir($dir . DIRECTORY_SEPARATOR . $object) && !is_link($dir . "/" . $object))
                        $this->rrmdir($dir . DIRECTORY_SEPARATOR . $object);
                    else
                        unlink($dir . DIRECTORY_SEPARATOR . $object);
                }
            }
            rmdir($dir);
        }

        return;
    }
}
