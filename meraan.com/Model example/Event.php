<?php

namespace App\Models;

use App\Models\EventMedia;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Storage;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Event extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_name',
        'intro',
        'event_date',
        'rating',
        'address',
        'start',
        'revenue',
        'sold_ticket',
        'ends',
        'longitude',
        'status',
        'latitude',
        'company_id',
        'activity_id',
        'country_id',
        'city_id',
        'zip_id',

    ];

    protected $casts = [
        'event_date' => 'date:hh:mm',
        'start'      => 'date:hh:mm',
        'ends'       => 'date:hh:mm'
    ];

    /**
     * event status
     */
    const STATUS = [
        'approved'   => 'approved',
        'waiting'    => 'waiting',
        'rejected'   => 'rejected',
        'draft'      => 'draft',
    ];

    public function eventsMedia()
    {
        return $this->hasMany('App\Models\EventMedia');
    }

    public function eventsDiscount()
    {
        return $this->hasMany('App\Models\Discount');
    }

    public function eventsImages()
    {
        return $this->hasMany('App\Models\EventMedia')->where('type_id', EventMedia::TYPE['event_img']);
    }

    public function eventsDocument()
    {
        return $this->hasMany('App\Models\EventMedia')->where('type_id', EventMedia::TYPE['event_doc']);
    }

    public function eventsSponsorImg()
    {
        return $this->hasMany('App\Models\EventMedia')->where('type_id', EventMedia::TYPE['sponsor_img']);
    }

    public function eventsOrganizerImg()
    {
        return $this->hasMany('App\Models\EventMedia')->where('type_id', EventMedia::TYPE['organizer_img']);
    }

    public function eventFaq()
    {
        return $this->hasMany('App\Models\EventFaq');
    }

    public function eventLocation()
    {
        return $this->belongsTo('App\Models\Location');
    }

    public function eventServices()
    {
        return $this->belongsToMany('App\Models\Service');
    }

    public function eventIncluding()
    {
        return $this->belongsToMany('App\Models\Including');
    }

    public function eventActivity()
    {
        return $this->belongsTo('App\Models\Activity', 'activity_id');
    }

    public function eventCompany()
    {
        return $this->belongsTo('App\Models\Company', 'company_id');
    }

    public function eventContactOrganizer()
    {
        return $this->hasOne('App\Models\OrganizerContact');
    }

    public function eventCategory()
    {
        return $this->hasMany('App\Models\EventCategory');
    }

    public function eventCountry()
    {
        return $this->belongsTo('App\Models\Country', 'country_id');
    }

    public function eventCity()
    {
        return $this->belongsTo('App\Models\City', 'city_id');
    }

    public function eventZip()
    {
        return $this->belongsTo('App\Models\Zip', 'zip_id');
    }

    public function eventReview()
    {
        return $this->hasMany('App\Models\Review');
    }

    public function scopeFilter($query, $params)
    {
        if (isset($params['event_name']) && trim($params['event_name'] !== '')) {
            $query->where('event_name', 'LIKE', '%' . trim($params['event_name']) . '%');
        }

        if (isset($params['address']) && trim($params['address'] !== '')) {
            $query->where('address', 'LIKE', '%' . trim($params['address']) . '%');
        }

        if (isset($params['activity_id']) && trim($params['activity_id']) !== '') {
            $query->where('activity_id', '=', trim($params['activity_id']));
        }

        if (isset($params['start_date']) && trim($params['start_date']) !== '') {
            $query->whereDate('event_date', '=', trim($params['start_date']));
        }

        if (isset($params['status'])) {
            if ($params['status'] == true) {
                $query->where('status', '=', 'published');
            }
        }

        return $query;
    }

    public function createUploadEventMedia($mediasData, $type, $dirName, array $url_id = null): array
    {
        foreach ($mediasData as $data) {
            $extension = preg_replace('/\s+/', '', $data->getClientOriginalName());
            $filename = Str::random(12) . '.' . $extension;
            $storagePath = 'public/' . $dirName . '/' . $filename;

            $url = $data->storeAs("public/{$dirName}", $filename);
            $filesData = [
                'url' =>  $url,
                'type_id' => $type,
                'file_name' => $data->getClientOriginalName(),
                'file_size' => self::filesizeFormatted($data)
            ];
            try {
                $media[] = $this->eventsMedia()->create($filesData);
            } catch (QueryException $e) {

                return [
                    'data' => '',
                    'status' => 500,
                    'message' => 'Something went wrong, please try again'
                ];
            }
        }
        return $media;
    }

    public static function filesizeFormatted($data)
    {
        $size = $data->getSize();
        $units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        $power = $size > 0 ? floor(log($size, 1024)) : 0;

        return number_format($size / pow(1024, $power), 2, '.', ',') . ' ' . $units[$power];
    }
}
