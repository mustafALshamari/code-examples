<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Event;
use App\Models\Review;
use Illuminate\Support\Arr;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Faker\Factory as Faker;

class ReviewSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        Review::truncate();
        $user = User::where('role_id', 1)->pluck('id')->toArray();
        $event = Event::pluck('id')->toArray();
        $randomUser = Arr::random($user, 8);
        $faker = Faker::create();

        for ($loopReview = 0; $loopReview < rand(5, 10); $loopReview++) {
            for ($loopEvents = 0; $loopEvents < count($event); $loopEvents++) {
                Review::create([
                    'user_id'  => $randomUser[$loopReview],
                    'event_id' => $event[$loopEvents],
                    'body'     => $faker->text(100),
                    'status'   => 'approved',
                    'rating'   => rand(3, 5)
                ]);
            }
        }

        $replyData = Review::inRandomOrder()->limit(50)->get();

        foreach ($replyData as $adminReply) {
            Review::create([
                'user_id'   => User::all()->last()->id,
                'event_id'  => $adminReply->event_id,
                'body'      => $faker->text(30),
                'status'    => 'approved',
                'parent_id' => $adminReply->id
            ]);
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }
}
