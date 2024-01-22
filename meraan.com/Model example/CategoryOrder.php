<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class CategoryOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'event_category_id',
        'category_name',
        'event_name',
        'currency',
        'ticket_number',
        'gift',
        'qr_code',
        'final_price',
    ];

    public function getQrcodeAttribute($value)
    {
        return Storage::url($value);
    }

    public function order()
    {
        return $this->belongsTo('App\Models\Order');
    }

    public function eventCategory()
    {
        return $this->belongsTo('App\Models\EventCategory');
    }

    protected static function boot()
    {
        parent::boot();
        CategoryOrder::created(function ($model) {
            $revenue = CategoryOrder::where('event_category_id', $model->event_category_id)->pluck('final_price')->sum();
            $soldTickets = CategoryOrder::where('event_category_id', $model->event_category_id)->get();

            EventCategory::find($model->event_category_id)->update(['revenue' => $revenue, 'sold_ticket' => count($soldTickets)]);
        });
    }
}
