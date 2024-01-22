<?php

namespace App\GraphQL\Repositories;

use App\Models\Event;
use App\Models\EventMedia;
use App\Helpers\FileHelper;
use Illuminate\Support\Arr;
use App\Models\EventCategory;
use Illuminate\Support\Facades\Storage;

class EventRepository
{
    public function updateEvent(object $auth, array $request): array
    {
        $company = $auth::user()->company;
        $event = $company->event()->find($request['event_id']);
        $event->update([
            'event_name'  => $request['event_name'],
            'intro'       => $request['intro'],
            'address'     => $request['event_address'],
            'longitude'   => $request['longitude'],
            'latitude'    => $request['latitude'],
            'event_date'  => $request['event_date'],
            'start'       => $request['start'],
            'ends'        => $request['ends'],
            'country_id'  => $request['country_id'],
            'city_id'     => $request['city_id'],
            'zip_id'      => $request['zip_id'],
            'activity_id' => $request['type_id'],
        ]);

        $directory = 'event_imgs';
        if (isset($request['event_img'])) {

            FileHelper::deleteMultiFileFromStorage($event->eventsImages, 'url');

            $media = $event->createUploadEventMedia(
                $request['event_img'],
                EventMedia::TYPE['event_img'],
                $directory,
            );
        }

        $event->eventServices()->detach();
        $event->eventServices()->attach($request['services']);

        $event->eventIncluding()->detach();
        $event->eventIncluding()->attach($request['includes']);

        return [
            'event' => $event,
            'media' => $media
        ];
    }


    public function updateEventCategory(object $auth, array $request): array
    {
        $company = $auth::user()->company;
        $event = $company->event()->find($request['event_id']);

        if (isset($request['category_img'])) {

            foreach ($request['category_img'] as $catImages) {
                $urlForImgs[] = FileHelper::uploadSingleFile($catImages, 'category_img');
            }
        }
        $catName  = $request['cat_name'];
        if (isset($catName)) {
            foreach ($catName as $dataCat =>  $value) {

                if (isset($request['category_img'])) {
                    $oldCategoryImg = $event->eventCategory()->find($request['event_category_id'][$dataCat]);
                    Storage::delete($oldCategoryImg->getAttributes()['img_url']);
                }

                $eventcatdata = [
                    'name'             => $request['cat_name'][$dataCat],
                    'distance'         => $request['distance'][$dataCat],
                    'cat_start'        => $request['cat_start'][$dataCat],
                    'cat_end'          => $request['cat_end'][$dataCat],
                    'fees'             => $request['fees'][$dataCat],
                    'img_url'          => $urlForImgs[$dataCat] ?? null,
                    'age_from'         => $request['age_from'][$dataCat],
                    'age_to'           => $request['age_to'][$dataCat],
                    'bib_from'         => $request['bib_from'][$dataCat],
                    'bib_to'           => $request['bib_to'][$dataCat],
                    'address'          => $request['start_address'][$dataCat],
                    'finish_address'   => $request['finish_address'][$dataCat],
                    'longitude_start'  => $request['longitude_start'][$dataCat],
                    'latitude_start'   => $request['latitude_start'][$dataCat],
                    'longitude_finish' => $request['longitude_finish'][$dataCat],
                    'latitude_finish'  => $request['latitude_finish'][$dataCat],
                ];
                $category = $event
                    ->eventCategory()
                    ->find($request['event_category_id'][$dataCat]);

                $category->update($eventcatdata);

                $participantManipulated = $request['participant'][$dataCat];

                foreach ($participantManipulated as $participantManipulatedLooped => $valueParticipant) {
                    $category
                        ->participants()->detach();
                    $category
                        ->participants()
                        ->attach($participantManipulated[$participantManipulatedLooped]);
                }

                $placeManipulated = $request['place'][$dataCat];
                $prizeManipulated = $request['prize'][$dataCat];

                foreach ($placeManipulated as $dataLooped => $value) {

                    $eventAwardData = [
                        'place' => $placeManipulated[$dataLooped],
                        'prize' => $prizeManipulated[$dataLooped]
                    ];

                    $category->eventAward()->update($eventAwardData);
                }

                $updatedCategories[] = $category;
            }

            return $updatedCategories;
        }
    }

    public function updateSponsorLogo(object $auth, array $request)
    {
        $company = $auth::user()->company;
        $event = $company->event()->find($request['event_id']);

        if ($event->eventsSponsorImg()->exists()) {
            FileHelper::deleteMultiFileFromStorage($event->eventsSponsorImg, 'url');
        }

        $directory = 'sponsor_imgs';
        $eventMediaData = $event->createUploadEventMedia(
            $request['sponsor_img'],
            EventMedia::TYPE['sponsor_img'],
            $directory
        );

        return $eventMediaData;
    }

    public function updateDocument(object $auth, array $request)
    {
        $company = $auth::user()->company;
        $event = $company->event()->find($request['event_id']);

        if ($event->eventsDocument()->exists()) {
            FileHelper::deleteMultiFileFromStorage($event->eventsDocument, 'url');
        }

        $directory = 'event_doc';
        $eventMediaData = $event->createUploadEventMedia(
            $request['event_doc'],
            EventMedia::TYPE['event_doc'],
            $directory
        );

        return $eventMediaData;
    }

    public function createOrganizer(object $auth, array $request)
    {
        $company = $auth::user()->company;
        $event = $company->event()->find($request['event_id']);

        $directory = 'organizer_img';
        if (isset($request['organizer_img'])) {
            $mediaData = $event->createUploadEventMedia(
                $request['organizer_img'],
                EventMedia::TYPE['organizer_img'],
                $directory
            );
        }
        $eventContactData = Arr::only($request, [
            'organizer_name',
            'contact_name',
            'phone',
            'email',
            'web_url',
            'facebook',
            'instagram',
            'twitter'
        ]);

        $createdOrganizer = $event->eventContactOrganizer()->create($eventContactData);

        return [
            'data' => $createdOrganizer,
            'media' => $mediaData ?? null,
            'status' => 200,
            'message' => 'Please continue the Event\'s creating procedure'
        ];
    }

    public function updateOrganizer(object $auth, array $request)
    {
        $company = $auth::user()->company;
        $event = $company->event()->find($request['event_id']);

        if ($event->eventsOrganizerImg()->exists()) {
            FileHelper::deleteMultiFileFromStorage($event->eventsOrganizerImg, 'url');
        }

        $directory = 'organizer_img';
        if (isset($request['organizer_img'])) {
            $mediaData = $event->createUploadEventMedia(
                $request['organizer_img'],
                EventMedia::TYPE['organizer_img'],
                $directory
            );
        }
        $eventContactData = Arr::only($request, [
            'organizer_name',
            'contact_name',
            'phone',
            'email',
            'web_url',
            'facebook',
            'instagram',
            'twitter'
        ]);

        $event->eventContactOrganizer()->update($eventContactData);

        return [
            'data' => $event->eventContactOrganizer,
            'media' => $mediaData ?? null,
            'status' => 201,
            'message' => 'Contact organizer updated!,Please continue the Event\'s creating procedure'
        ];
    }

    public function updateFaq(object $auth, array $request)
    {
        $company = $auth::user()->company;
        $event = $company->event()->find($request['event_id']);

        $question = $request['question'];
        $answer = $request['answer'];
        $eventFaqId = $request['event_faq_id'];

        if (isset($question)) {
            foreach ($question as $data =>  $value) {

                $event->eventFaq()->find($eventFaqId[$data])->update([
                    'question' => $question[$data],
                    'answer' => $answer[$data] ?: ' '
                ]);
            }
        }

        return $event->eventFaq;
    }

    public function updateDiscountCode(object $auth, array $request)
    {
        $company = $auth::user()->company;
        $event = $company->event()->find($request['event_id']);

        foreach ($request['code'] as $code => $value) {
            $event->eventsDiscount()->find($request['code_id'][$code])->update([
                'code'       => strtoupper($request['code'][$code]),
                'discount'   => $request['discount'][$code],
                'limit'      => $request['limit'][$code],
                'status'     => 'active',
                'valid_from' => $request['valid_from'][$code],
                'valid_to'   => $request['valid_to'][$code],
            ]);

            $updateDiscountCodes[] = $event->eventsDiscount()->find($request['code_id'][$code]);
        }

        return $updateDiscountCodes;
    }
}
