<?php

namespace Database\Seeders;

use App\Models\Event;
use App\Models\EventCategory;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;
use App\Models\EventMedia;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\File;
use Faker\Factory as Faker;

class EventSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('events')->truncate();
        DB::table('event_categories')->truncate();
        DB::table('event_faqs')->truncate();
        DB::table('event_including')->truncate();
        DB::table('event_media')->truncate();
        DB::table('event_service')->truncate();
        DB::table('event_category_participant')->truncate();
        DB::table('organizer_contacts')->truncate();
        DB::table('awards')->truncate();
        DB::table('discounts')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $companyOwner = User::all()->last()->company;

        $event = $companyOwner->event();

        $this->rrmdir(storage_path("app/public/public/1"));
        $this->rrmdir(storage_path("app/public/public/2"));
        $this->rrmdir(storage_path("app/public/public/3"));
        $this->rrmdir(storage_path("app/public/public/cat_imgs"));


        for ($i = 0; $i < 20; $i++) {
            $randNum = Str::random(4);
            $event_names = [
                "Urban-Ultra Coast-$randNum Challenge 2021",
                "Urban-Ultra Cycle-$randNum Challenge 2020"
            ];
            $faker = Faker::create();

            $cities = [
                '4 15 St - Al BarshaAl Barsha 3 - Dubai',
                '8 Street 39A - Al BarshaAl Barsha 2 - Dubai',
                '185 Sheikh Zayed St - Halwan SuburbAl Abar - Sharjah'
            ];

            $status = ['published', 'pending'];

            $createdEvent = $event->create([
                'event_name'    => Arr::random($event_names),
                'intro'         => $faker->text(1000),
                'address'       => Arr::random($cities),
                'longitude'     => '55.241390',
                'latitude'      => '25.187992',
                'event_date'    => Carbon::now()->addDays(rand(1, 5)),
                'start'         => Carbon::now()->addDays(rand(2, 10)),
                'ends'          => Carbon::now()->addDays(rand(10, 20)),
                'country'       => 'UAE',
                'status'        => Arr::random($status),
                'activity_id'   => rand(1, 2),
            ]);

            $this->creteCategories($createdEvent);

            //attach  services to event
            $eventServices = $createdEvent->eventServices();
            $eventServices->attach([1, 2, 3]);

            //attach  includes to event
            $eventIncludes = $createdEvent->eventIncluding();
            $eventIncludes->attach([1, 2, 3]);

            //contact organizer data
            $eventContact = $createdEvent->eventContactOrganizer();
            $eventContact->create([
                'organizer_name' => 'Patrick Jemis' . rand(0, 100),
                'contact_name' => 'Patrick',
                'phone' => '+97165021111',
                'email' => 'patric@jemis-events.com',
                'web_url' => 'jemis-events.com',
                'facebook' => 'https://www.facebook.com/jemis_event',
                'instagram' => 'https://www.instgram.com/jemis-event',
                'twitter' => 'https://www.twitter.com/jemis-event'
            ]);

            //faqs data collect
            $eventFaq = $createdEvent->eventFaq();
            $question = ["By what time should I arrive to the event venue?", "Will there be support stations?"];
            $answer = ["At least 30 minutes before the event starts", "Yes, there will be 3 support stations"];
            foreach ($question as $key => $q) {
                $eventFaq->create([
                    'question' =>  $q,
                    'answer' => $answer[$key]
                ]);
            }

            $this->createEventMedia($createdEvent);
            $this->createDiscount($createdEvent);
        }
    }

    private function creteCategories(Event $event)
    {
        $category = $event->eventCategory();

        $catsData = [3, 5, 10, 20];
        $address = ["Dwar Al Siha, Sharja", "Rak Cournich 33, Ras Al Khaimah"];
        $finishAddress = ["Jumairah St, 3 , Dubai", "Al Hamarah City , Ras Al Khaimah"];

        // $filename = Str::random(12) . '.' . $extension;
        // dd($filename);


        $imgForCat = public_path() . '/img/event' . rand(0, 3) . '.jpg';

        $urlForImgCat = $this->uploadCategoryImg($imgForCat);

        foreach ($catsData as $catData) {
            $fee = $catData * 100;
            $newCategory = $category->create([
                'name'             => $catData . 'k',
                'distance'         => $catData,
                'img_url'          => $urlForImgCat,
                'cat_start'        => Carbon::now()->addDays(rand(1, 5)),
                'cat_end'          => Carbon::now()->addDays(rand(6, 10)),
                'age_from'         => rand(20, 30),
                'age_to'           => rand(35, 45),
                'fees'             => "$fee",
                'bib_from'         => rand(1, 100),
                'bib_to'           => rand(101, 120),
                'address'          => Arr::random($address),
                'finish_address'   => Arr::random($finishAddress),
                'longitude_start'  => '55.' . rand(100000, 999999),
                'latitude_start'   => '25.' . rand(100000, 999999),
                'longitude_finish' => '55.' . rand(100000, 999999),
                'latitude_finish'  => '25.' . rand(100000, 999999),
            ]);

            $this->createAwards($newCategory);
            $this->createParticipantEvent($newCategory);
        }
    }

    private function createAwards(EventCategory $category): void
    {
        $places = [['1', '2', '3'], ['1', '2', '3', '4', '5']];

        foreach ($places[rand(0, 1)] as $place) {
            $prize = $place * 100;

            $category->eventAward()->create([
                'place' => $place,
                'prize' => $prize,
            ]);
        }

        return;
    }

    public function createParticipantEvent(EventCategory $category)
    {
        $participant = ['1', '2'];

        foreach ($participant as $valueParticipant) {

            $category->participants()->attach($valueParticipant);
        }
    }

    private function createEventMedia(Event $event): void
    {
        $media = $event->eventsMedia();

        $mediasData = [
            EventMedia::TYPE['event_img'] => [
                public_path() . '/img/event' . rand(0, 3) . '.jpg',
                public_path() . '/img/event' . rand(0, 3) . '.jpg',
            ],
            EventMedia::TYPE['sponsor_img'] => [
                public_path() . '/partners/' . rand(0, 2) . '.png',
                public_path() . '/partners/' . rand(0, 2) . '.png'
            ],
            EventMedia::TYPE['event_doc'] => [
                public_path() . '/document/Doc' . rand(1, 3) . '.txt',
                public_path() . '/document/Doc' . rand(1, 3) . '.txt',
                public_path() . '/document/Doc' . rand(1, 3) . '.txt'
            ],
        ];

        foreach ($mediasData as $type => $data) {

            foreach ($data as $value) {
                $extension = File::extension($value);
                $filename = Str::random(12) . '.' . $extension;
                $storagePath = 'public/' . $type . '/' . $filename;
                Storage::put($storagePath, (string) file_get_contents($value), 'public');
           
                $media->create([
                    'url' =>  $storagePath,
                    'type_id' => $type,
                    'file_size' => filesize($value) . 'B',
                    'file_name' => "event-" . rand(0, 20) . ".$extension"
                ]);
            }
        }
        return;
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

    protected function uploadCategoryImg($img): string
    {
        $extension = File::extension($img);

        $filename = time() . '.' . $extension;
        $path = 'public/' . 'cat_imgs' . '/' . $filename;
        Storage::put($path, (string) file_get_contents($img), 'public');
       
        return $path;
    }

    private function createDiscount(Event $event): void
    {
        $args['code']  = [Str::random(8), Str::random(8, Str::random(8))];
        $args['discount'] = [10, 15, 20];
        $args['limit'] = [10, 20, 40];

        foreach ($args['code'] as $code => $value) {
            $event->eventsDiscount()->create([
                'code'       => strtoupper($args['code'][$code]),
                'discount'   => $args['discount'][$code],
                'limit'      => $args['limit'][$code],
                'status'     => 'active',
                'counter'    => rand(5, 21),
                'valid_from' => Carbon::now(),
                'valid_to'   => Carbon::now()->addDays(rand(10, 30)),
            ]);
        }
    }
}
