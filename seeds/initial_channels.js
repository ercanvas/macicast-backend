exports.seed = async function(knex) {
  // First, delete existing entries
  await knex('channels').del();
  
  // Then insert sample channels
  await knex('channels').insert([
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
      name: 'TRT Çocuk',
      channel_number: 5,
      stream_url: 'https://tv-trtcocuk.medya.trt.com.tr/master.m3u8',
      logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/TRT_%C3%87ocuk_logo_%282021%29.svg/512px-TRT_%C3%87ocuk_logo_%282021%29.svg.png',
      category: 'Çocuk',
      is_active: true,
      is_hls: true
    }
  ]);
};
