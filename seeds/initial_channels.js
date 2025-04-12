const Channel = require('../models/Channel');

exports.seed = async function() {
  try {
    // First, check if data already exists
    const count = await Channel.countDocuments();
    if (count > 0) {
      console.log('Channels already exist, skipping seed');
      return;
    }
    
    // Insert sample channels
    const channels = [
      {
        name: 'TRT 1',
        channel_number: 1,
        stream_url: 'https://tv-trt1.medya.trt.com.tr/master.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/TRT_1_logo_%282021-%29.svg/512px-TRT_1_logo_%282021-%29.svg.png',
        category: 'Ulusal',
        is_active: true,
        is_hls: true
      },
      {
        name: 'Show TV',
        channel_number: 2,
        stream_url: 'https://ciner-live.daioncdn.net/showtv/showtv.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Show_TV_logo.svg/512px-Show_TV_logo.svg.png',
        category: 'Ulusal',
        is_active: true,
        is_hls: true
      },
      {
        name: 'TRT Haber',
        channel_number: 3,
        stream_url: 'https://tv-trthaber.medya.trt.com.tr/master.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/TRT_Haber_logo_%282013-2020%29.png/512px-TRT_Haber_logo_%282013-2020%29.png',
        category: 'Haber',
        is_active: true,
        is_hls: true
      },
      {
        name: 'TRT Spor',
        channel_number: 4,
        stream_url: 'https://tv-trtspor1.medya.trt.com.tr/master.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/TRT_Spor_logo_%282022%29.svg/512px-TRT_Spor_logo_%282022%29.svg.png',
        category: 'Spor',
        is_active: true,
        is_hls: true
      },
      {
        name: 'NTV',
        channel_number: 5,
        stream_url: 'https://dogus-live.daioncdn.net/ntv/ntv.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/NTV_logo.svg/512px-NTV_logo.svg.png',
        category: 'Haber',
        is_active: true,
        is_hls: true
      },
      {
        name: 'TRT Çocuk',
        channel_number: 6,
        stream_url: 'https://tv-trtcocuk.medya.trt.com.tr/master.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/TRT_%C3%87ocuk_logo_%282021%29.svg/512px-TRT_%C3%87ocuk_logo_%282021%29.svg.png',
        category: 'Çocuk',
        is_active: true,
        is_hls: true
      },
      {
        name: 'Fox TV',
        channel_number: 7,
        stream_url: 'https://foxtv.blutv.com/blutv_foxtv_live/live.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/FOX_TV_logo.svg/512px-FOX_TV_logo.svg.png',
        category: 'Ulusal',
        is_active: true,
        is_hls: true
      },
      {
        name: 'A Haber',
        channel_number: 8,
        stream_url: 'https://www.youtube.com/embed/WAWxQ6ogKcE?autoplay=1&controls=1&rel=0',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/A_Haber_logo.svg/512px-A_Haber_logo.svg.png',
        category: 'Haber',
        is_active: true,
        is_hls: true,
        type: 'youtube-live'
      },
      {
        name: 'Star TV',
        channel_number: 9,
        stream_url: 'https://startv.blutv.com/blutv_startv_live/live.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Star_TV_logo.svg/512px-Star_TV_logo.svg.png',
        category: 'Ulusal',
        is_active: true,
        is_hls: true
      },
      {
        name: 'Kanal D',
        channel_number: 10,
        stream_url: 'https://kanald.blutv.com/blutv_kanald_live/live.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Kanal_D_logo.svg/512px-Kanal_D_logo.svg.png',
        category: 'Ulusal',
        is_active: true,
        is_hls: true
      },
      {
        name: 'ATV',
        channel_number: 11,
        stream_url: 'https://atv.blutv.com/blutv_atv_live/live.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Atv_logo.svg/512px-Atv_logo.svg.png',
        category: 'Ulusal',
        is_active: true,
        is_hls: true
      },
      {
        name: 'TRT Belgesel',
        channel_number: 12,
        stream_url: 'https://tv-trtbelgesel.medya.trt.com.tr/master.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/TRT_Belgesel_logo_%282019-%29.svg/512px-TRT_Belgesel_logo_%282019-%29.svg.png',
        category: 'Belgesel',
        is_active: true,
        is_hls: true
      },
      {
        name: 'CNN Türk',
        channel_number: 13,
        stream_url: 'https://cnnturk.blutv.com/blutv_cnnturk_live/live.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/CNN_T%C3%BCrk_logo.svg/512px-CNN_T%C3%BCrk_logo.svg.png',
        category: 'Haber',
        is_active: true,
        is_hls: true
      },
      {
        name: 'Habertürk',
        channel_number: 14,
        stream_url: 'https://haberturk.blutv.com/blutv_haberturk_live/live.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Habert%C3%BCrk_logo.svg/512px-Habert%C3%BCrk_logo.svg.png',
        category: 'Haber',
        is_active: true,
        is_hls: true
      },
      {
        name: 'TLC',
        channel_number: 15,
        stream_url: 'https://tlc.blutv.com/blutv_tlc_live/live.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/TLC_Logo.svg/512px-TLC_Logo.svg.png',
        category: 'Belgesel',
        is_active: true,
        is_hls: true
      },
      {
        name: 'DMAX',
        channel_number: 16,
        stream_url: 'https://dmax.blutv.com/blutv_dmax_live/live.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/DMAX_BLACK.svg/512px-DMAX_BLACK.svg.png',
        category: 'Belgesel',
        is_active: true,
        is_hls: true
      },
      {
        name: 'Beyaz TV',
        channel_number: 17,
        stream_url: 'https://beyaztv.blutv.com/blutv_beyaztv_live/live.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/tr/thumb/8/87/Beyaz_TV_logo.svg/512px-Beyaz_TV_logo.svg.png',
        category: 'Ulusal',
        is_active: true,
        is_hls: true
      },
      {
        name: 'TV8',
        channel_number: 18,
        stream_url: 'https://tv8.blutv.com/blutv_tv8_live/live.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/tr/thumb/3/36/TV8_Yeni_Logo.svg/512px-TV8_Yeni_Logo.svg.png',
        category: 'Ulusal',
        is_active: true,
        is_hls: true
      },
      {
        name: 'LiveNOW from FOX',
        channel_number: 19,
        stream_url: 'https://www.youtube.com/embed/FMX1F-G6e8w?autoplay=1&controls=1&rel=0',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FOX_NOW_logo.svg/512px-FOX_NOW_logo.svg.png',
        category: 'Haber',
        is_active: true,
        is_hls: true,
        type: 'youtube-live'
      },
      {
        name: 'TRT Müzik',
        channel_number: 20,
        stream_url: 'https://tv-trtmuzik.medya.trt.com.tr/master.m3u8',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/TRT_M%C3%BCzik_logo.svg/512px-TRT_M%C3%BCzik_logo.svg.png',
        category: 'Müzik',
        is_active: true,
        is_hls: true
      }
    ];
    
    await Channel.insertMany(channels);
    console.log(`✅ Inserted ${channels.length} channels`);
  } catch (error) {
    console.error('Error seeding channels:', error);
  }
};
