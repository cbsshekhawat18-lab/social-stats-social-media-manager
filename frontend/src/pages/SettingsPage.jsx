import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useOAuthStatus } from '../hooks/useData';
import { clientsAPI } from '../services/api';
import ConnectedAccounts from '../components/ui/ConnectedAccounts';
import CompetitorSection from '../components/ui/CompetitorSection';
import PageHeader from '../components/layout/PageHeader';
import {
  Building2, ImagePlus, Loader2, Palette, Save, Sparkles, Target, Upload, Users, X,
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const CYAN = '#00d7ff';
const CYAN_SOFT = 'rgba(31, 182, 207, 0.16)';

const BUSINESS_CATEGORIES = [
  'Electronics', 'Retail', 'Services', 'Food & Beverage', 'Healthcare',
  'Education', 'Real Estate', 'Automotive', 'Hospitality', 'Manufacturing',
  'Technology', 'Fashion', 'Sports & Recreation', 'Beauty & Wellness',
  'Home & Garden', 'Other'
];

const BRAND_TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'funny', label: 'Funny' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'friendly', label: 'Friendly' },
];

const SOCIAL_PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'google_my_business', label: 'Google My Business' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Other' },
];

const GENDERS = [
  { value: 'all', label: 'All' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'unspecified', label: 'Unspecified' },
];

export default function SettingsPage({ clientId: propClientId }) {
  const { user }   = useAuth();
  const clientId   = propClientId || user?.client_id;
  const { status, refetch } = useOAuthStatus(clientId);
  const [searchParams, setSearchParams] = useSearchParams();
  const didRefetch = useRef(false);

  // Business Profile State
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('accounts');
  const [formData, setFormData] = useState({
    // Business Basics
    name: '',
    company: '',
    email: '',
    phone: '',
    whatsapp_number: '',
    website: '',
    gmb_url: '',

    // Brand Profile
    business_category: '',
    business_subcategories: [],
    brand_description: '',
    usp: '',
    brand_tone: '',
    target_audience: '',
    gender: 'all',
    business_location: '',
    target_locations: [],

    // Assets
    profile_image: null,
    product_images: [],
    brand_assets: {},

    // Competitors
    competitors: [],
  });

  // Load client data
  useEffect(() => {
    const loadClientData = async () => {
      try {
        const response = await clientsAPI.get(clientId);
        const client = response.data;
        
        setFormData({
          name: client.name || '',
          company: client.company || '',
          email: client.email || '',
          phone: client.phone || '',
          whatsapp_number: client.whatsapp_number || '',
          website: client.website || '',
          gmb_url: client.gmb_url || '',
          business_category: client.business_category || '',
          business_subcategories: client.business_subcategories || [],
          brand_description: client.brand_description || '',
          usp: client.usp || '',
          brand_tone: client.brand_tone || '',
          target_audience: client.target_audience || '',
          gender: client.gender || 'all',
          business_location: client.business_location || '',
          target_locations: client.target_locations || [],
          profile_image: null, // File objects can't be pre-loaded
          product_images: [],
          brand_assets: client.brand_assets || {},
          competitors: (client.competitors || []).map(comp => ({
            ...comp,
            social_links: Array.isArray(comp.social_links)
              ? comp.social_links
              : Object.entries(comp.social_links || {}).map(([platform, url]) => ({ platform, url }))
          })),

        });
      } catch (error) {
        console.error('Failed to load client data:', error);
      } finally {
        setProfileLoading(false);
      }
    };

    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if ((connected !== null || error !== null) && !didRefetch.current) {
      didRefetch.current = true;
      refetch();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, refetch, setSearchParams]);

  // Form handlers
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubcategoryToggle = (subcategory) => {
    setFormData(prev => ({
      ...prev,
      business_subcategories: prev.business_subcategories.includes(subcategory)
        ? prev.business_subcategories.filter(s => s !== subcategory)
        : [...prev.business_subcategories, subcategory]
    }));
  };

  const handleLocationToggle = (location) => {
    setFormData(prev => ({
      ...prev,
      target_locations: prev.target_locations.includes(location)
        ? prev.target_locations.filter(l => l !== location)
        : [...prev.target_locations, location]
    }));
  };

  const handleFileUpload = (field, files) => {
    if (field === 'product_images') {
      setFormData(prev => ({
        ...prev,
        product_images: [...prev.product_images, ...Array.from(files)]
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: files[0] }));
    }
  };

  const removeFile = (field, index) => {
    if (field === 'product_images') {
      setFormData(prev => ({
        ...prev,
        product_images: prev.product_images.filter((_, i) => i !== index)
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: null }));
    }
  };

  const addCompetitor = () => {
    setFormData(prev => ({
      ...prev,
      competitors: [...prev.competitors, { name: '', social_links: [{ platform: 'facebook', url: '' }] }]
    }));
  };

  const updateCompetitor = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      competitors: prev.competitors.map((comp, i) =>
        i === index ? { ...comp, [field]: value } : comp
      )
    }));
  };

  const removeCompetitor = (index) => {
    setFormData(prev => ({
      ...prev,
      competitors: prev.competitors.filter((_, i) => i !== index)
    }));
  };

  const addCompetitorLink = (index) => {
    setFormData(prev => ({
      ...prev,
      competitors: prev.competitors.map((comp, i) =>
        i === index ? {
          ...comp,
          social_links: [
            ...(comp.social_links || []),
            { platform: 'facebook', url: '' }
          ]
        } : comp
      )
    }));
  };

  const updateCompetitorLink = (index, linkIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      competitors: prev.competitors.map((comp, i) =>
        i === index ? {
          ...comp,
          social_links: (comp.social_links || []).map((link, li) =>
            li === linkIndex ? { ...link, [field]: value } : link
          )
        } : comp
      )
    }));
  };

  const removeCompetitorLink = (index, linkIndex) => {
    setFormData(prev => ({
      ...prev,
      competitors: prev.competitors.map((comp, i) =>
        i === index ? {
          ...comp,
          social_links: (comp.social_links || []).filter((_, li) => li !== linkIndex)
        } : comp
      )
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const submitData = new FormData();
      const normalizedData = {
        ...formData,
        competitors: formData.competitors.map(comp => ({
          ...comp,
          social_links: (comp.social_links || []).reduce((acc, link) => {
            if (link.platform && link.url) acc[link.platform] = link.url;
            return acc;
          }, {})
        }))
      };

      Object.keys(normalizedData).forEach(key => {
        if (normalizedData[key] === null || normalizedData[key] === undefined) {
          return;
        }
        if (key === 'profile_image' && formData[key]) {
          submitData.append(key, formData[key]);
        } else if (key === 'product_images') {
          formData[key].forEach((file, index) => {
            submitData.append(`product_images[${index}]`, file);
          });
        } else if (Array.isArray(formData[key]) || typeof formData[key] === 'object') {
          submitData.append(key, JSON.stringify(formData[key]));
        } else {
          submitData.append(key, formData[key]);
        }
      });

      await clientsAPI.update(clientId, submitData);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Helper function for subcategories
  const getSubcategoriesForCategory = (category) => {
    const subcategories = {
      'Electronics': ['Consumer Electronics', 'Computer Stores', 'Mobile Phones', 'Audio Equipment', 'Video Games', 'Cameras', 'Drones', 'Smart Devices', 'Electronic Repair', 'Security Systems'],
      'Retail': ['Department Stores', 'Specialty Shops', 'Online Retail', 'Wholesale', 'Discount Stores', 'Convenience Stores', 'Pharmacies', 'Bookstores', 'Pet Stores', 'Sporting Goods'],
      'Services': ['Cleaning Services', 'Maintenance', 'Repair Services', 'Installation', 'Delivery', 'Courier', 'Security Services', 'Waste Management', 'Recycling', 'Laundry'],
      'Food & Beverage': ['Restaurants', 'Cafes', 'Fast Food', 'Bakeries', 'Catering', 'Delivery', 'Bars & Nightclubs', 'Food Trucks', 'Grocery Stores', 'Specialty Foods'],
      'Healthcare': ['Hospitals', 'Clinics', 'Dentistry', 'Pharmacy', 'Fitness', 'Mental Health', 'Chiropractic', 'Physical Therapy', 'Medical Supplies', 'Home Health Care'],
      'Education': ['Schools', 'Universities', 'Tutoring', 'Online Learning', 'Training', 'Courses', 'Daycare', 'Preschools', 'Language Schools', 'Music Schools'],
      'Real Estate': ['Residential', 'Commercial', 'Property Management', 'Real Estate Agents', 'Construction', 'Mortgage Brokers', 'Appraisal Services', 'Property Development'],
      'Automotive': ['Car Dealerships', 'Auto Repair', 'Car Rental', 'Parts', 'Motorcycles', 'Towing', 'Detailing', 'Car Wash', 'Tire Shops', 'Auto Insurance'],
      'Hospitality': ['Hotels', 'Resorts', 'Travel Agencies', 'Tourism', 'Events', 'Bed & Breakfast', 'Vacation Rentals', 'Cruise Lines', 'Airbnb Hosts'],
      'Manufacturing': ['Industrial', 'Consumer Goods', 'Textiles', 'Electronics', 'Food Processing', 'Chemicals', 'Machinery', 'Plastics', 'Metalworking', 'Packaging'],
      'Technology': ['Software', 'Hardware', 'IT Services', 'Startups', 'Consulting', 'Web Development', 'Mobile Apps', 'Cloud Services', 'Cybersecurity', 'Data Analytics'],
      'Fashion': ['Clothing', 'Accessories', 'Shoes', 'Jewelry', 'Boutiques', 'Designer Brands', 'Vintage Clothing', 'Sportswear', 'Lingerie', 'Costume Design'],
      'Sports & Recreation': ['Gyms', 'Sports Clubs', 'Outdoor Activities', 'Fitness', 'Leisure', 'Sports Equipment', 'Adventure Sports', 'Yoga Studios', 'Martial Arts', 'Dance Studios'],
      'Beauty & Wellness': ['Salons', 'Spas', 'Cosmetics', 'Wellness Centers', 'Personal Care', 'Nail Salons', 'Barber Shops', 'Tattoo Parlors', 'Massage Therapy', 'Aromatherapy'],
      'Home & Garden': ['Home Improvement', 'Gardening', 'Furniture', 'Decor', 'Tools', 'Landscaping', 'Interior Design', 'Home Staging', 'Smart Home', 'Pest Control'],
      'Professional Services': ['Accounting', 'Marketing', 'Advertising', 'Consulting', 'Legal Services', 'Architecture', 'Engineering', 'Photography', 'Graphic Design', 'Event Planning'],
      'Entertainment': ['Movie Theaters', 'Music Venues', 'Comedy Clubs', 'Art Galleries', 'Museums', 'Theaters', 'Concert Halls', 'Amusement Parks', 'Arcades', 'Escape Rooms'],
      'Transportation': ['Taxi Services', 'Ride Sharing', 'Delivery Services', 'Logistics', 'Shipping', 'Moving Services', 'Bus Services', 'Rail Services', 'Airports', 'Parking'],
      'Agriculture': ['Farms', 'Greenhouses', 'Nurseries', 'Livestock', 'Crop Production', 'Organic Farming', 'Agricultural Equipment', 'Seed Suppliers', 'Farmers Markets', 'Agricultural Consulting'],
      'Financial Services': ['Banks', 'Credit Unions', 'Investment Firms', 'Insurance', 'Mortgage Lenders', 'Financial Planning', 'Tax Services', 'Payroll Services', 'Cryptocurrency', 'Fintech'],
      'Legal Services': ['Law Firms', 'Notary Services', 'Paralegal Services', 'Legal Consulting', 'Mediation Services', 'Court Reporting', 'Intellectual Property', 'Immigration Law', 'Family Law', 'Corporate Law'],
      'Construction': ['General Contractors', 'Electrical', 'Plumbing', 'HVAC', 'Roofing', 'Flooring', 'Painting', 'Carpentry', 'Masonry', 'Demolition'],
      'Media & Communications': ['Newspapers', 'TV Stations', 'Radio Stations', 'Podcasting', 'Social Media', 'Public Relations', 'Journalism', 'Film Production', 'Advertising Agencies', 'Publishing'],
      'Non-Profit': ['Charities', 'Foundations', 'NGOs', 'Community Organizations', 'Religious Organizations', 'Environmental Groups', 'Animal Welfare', 'Youth Organizations', 'Arts & Culture', 'Education Advocacy'],
      'Government': ['Municipal Services', 'State Agencies', 'Federal Agencies', 'Public Safety', 'Utilities', 'Transportation', 'Parks & Recreation', 'Libraries', 'Courts', 'Licensing']
    };
    return subcategories[category] || [];
  };

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Settings"
        subtitle="Manage your account and business profile."
      />

      <div style={heroStyle}>
        <div>
          <span style={heroBadgeStyle}>Business Profile</span>
          <h2 style={heroTitleStyle}>Keep your settings aligned with onboarding</h2>
          <p style={heroTextStyle}>
            Everything here mirrors the information that powers your dashboard, content generation, and reporting experience.
          </p>
        </div>
        <div style={heroPanelStyle}>
          <div style={heroPanelLabelStyle}>Profile coverage</div>
          <div style={heroPanelValueStyle}>
            {[
              formData.company,
              formData.business_category,
              formData.target_audience,
              formData.business_location,
            ].filter(Boolean).length}/4
          </div>
          <div style={heroPanelTextStyle}>Core profile areas completed</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: 32 }}>
        <div style={tabBarStyle}>
          <button
            onClick={() => setActiveTab('accounts')}
            style={{
              ...tabStyle,
              ...(activeTab === 'accounts' ? activeTabStyle : {}),
            }}
          >
            Connect Accounts
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              ...tabStyle,
              ...(activeTab === 'profile' ? activeTabStyle : {}),
            }}
          >
            Business Profile
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'accounts' && (
        <ConnectedAccounts
          clientId={clientId}
          status={status}
          onRefresh={refetch}
        />
      )}

      {activeTab === 'profile' && (
        <div>
          {profileLoading ? (
            <div style={loadingStateStyle}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: CYAN }} />
              <div style={{ marginTop: 16, color: '#6b7280' }}>Loading profile...</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 24 }}>
              {/* Business Basics */}
              <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <div style={sectionIconStyle}>
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h3 style={sectionTitleStyle}>Business Basics</h3>
                    <p style={sectionCopyStyle}>The details that anchor your workspace and keep your business identity consistent.</p>
                  </div>
                </div>
                <div style={gridTwoStyle}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Your Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      style={inputStyle}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Business Name <span style={{ color: '#ef4444', marginLeft: 2, fontWeight: 800 }}>*</span></label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      style={inputStyle}
                      placeholder="Your company name"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      style={inputStyle}
                      placeholder="business@email.com"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Phone Number</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      style={inputStyle}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>WhatsApp Number</label>
                    <input
                      type="tel"
                      value={formData.whatsapp_number}
                      onChange={(e) => handleInputChange('whatsapp_number', e.target.value)}
                      style={inputStyle}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      style={inputStyle}
                      placeholder="https://yourwebsite.com"
                    />
                  </div>
                </div>
              </div>

              {/* Brand Profile */}
              <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <div style={sectionIconStyle}>
                    <Palette size={18} />
                  </div>
                  <div>
                    <h3 style={sectionTitleStyle}>Brand Profile</h3>
                    <p style={sectionCopyStyle}>Define tone, category, and the story your content should always reinforce.</p>
                  </div>
                </div>
                <div style={gridTwoStyle}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Business Category</label>
                    <select
                      value={formData.business_category}
                      onChange={(e) => handleInputChange('business_category', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select category</option>
                      {BUSINESS_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Brand Tone</label>
                    <select
                      value={formData.brand_tone}
                      onChange={(e) => handleInputChange('brand_tone', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select tone</option>
                      {BRAND_TONES.map(tone => (
                        <option key={tone.value} value={tone.value}>{tone.label}</option>
                      ))}
                    </select>
                  </div>
                  {formData.business_category && getSubcategoriesForCategory(formData.business_category).length > 0 && (
                    <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Subcategories (select all that apply)</label>
                      <div style={pillGridStyle}>
                        {getSubcategoriesForCategory(formData.business_category).map(sub => (
                          <label
                            key={sub}
                            style={{
                              ...checkboxPillStyle,
                              ...(formData.business_subcategories.includes(sub) ? checkboxPillActiveStyle : {}),
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={formData.business_subcategories.includes(sub)}
                              onChange={() => handleSubcategoryToggle(sub)}
                              style={checkboxStyle}
                            />
                            <span>{sub}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Brand Description</label>
                    <textarea
                      value={formData.brand_description}
                      onChange={(e) => handleInputChange('brand_description', e.target.value)}
                      style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                      placeholder="Describe your brand in 2-3 sentences..."
                    />
                  </div>
                  <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Unique Selling Proposition (USP)</label>
                    <textarea
                      value={formData.usp}
                      onChange={(e) => handleInputChange('usp', e.target.value)}
                      style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                      placeholder="What makes your business unique?"
                    />
                  </div>
                </div>
              </div>

              {/* Audience */}
              <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <div style={sectionIconStyle}>
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 style={sectionTitleStyle}>Target Audience</h3>
                    <p style={sectionCopyStyle}>Keep your messaging focused on the people you actually want to reach.</p>
                  </div>
                </div>
                <div style={gridTwoStyle}>
                  <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Target Audience Description</label>
                    <textarea
                      value={formData.target_audience}
                      onChange={(e) => handleInputChange('target_audience', e.target.value)}
                      style={textareaStyle}
                      placeholder="Describe your ideal customers..."
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Primary Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      style={inputStyle}
                    >
                      {GENDERS.map(gender => (
                        <option key={gender.value} value={gender.value}>{gender.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Business Location</label>
                    <input
                      type="text"
                      value={formData.business_location}
                      onChange={(e) => handleInputChange('business_location', e.target.value)}
                      style={inputStyle}
                      placeholder="City, State/Country"
                    />
                  </div>
                  <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Target Locations</label>
                    <div style={pillGridStyle}>
                      {['Local (Same City)', 'Regional (Same State/Province)', 'National', 'International'].map(loc => (
                        <label
                          key={loc}
                          style={{
                            ...checkboxPillStyle,
                            ...(formData.target_locations.includes(loc) ? checkboxPillActiveStyle : {}),
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={formData.target_locations.includes(loc)}
                            onChange={() => handleLocationToggle(loc)}
                            style={checkboxStyle}
                          />
                          <span>{loc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Assets */}
              <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <div style={sectionIconStyle}>
                    <ImagePlus size={18} />
                  </div>
                  <div>
                    <h3 style={sectionTitleStyle}>Brand Assets</h3>
                    <p style={sectionCopyStyle}>Use the same asset experience from onboarding so brand visuals stay organized.</p>
                  </div>
                </div>
                <div style={assetGridStyle}>
                  <div style={assetCardStyle}>
                    <div style={assetTitleStyle}>Profile Image</div>
                    <div style={assetTextStyle}>Upload a logo or a strong profile mark for your brand.</div>
                    <div style={uploadStackStyle}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload('profile_image', e.target.files)}
                        style={{ display: 'none' }}
                        id="settings-profile-image"
                      />
                      <label htmlFor="settings-profile-image" style={uploadLabelStyle}>
                        <Upload size={16} />
                        Choose Profile Image
                      </label>
                      {formData.profile_image && (
                        <div style={previewWrapStyle}>
                          <img src={URL.createObjectURL(formData.profile_image)} alt="Profile" style={previewImageStyle} />
                          <button onClick={() => removeFile('profile_image')} style={removeBtnStyle}>
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={assetCardAltStyle}>
                    <div style={assetTitleStyle}>Product Images</div>
                    <div style={assetTextStyle}>Keep a few product or service visuals handy for creative generation later.</div>
                    <div style={uploadStackStyle}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleFileUpload('product_images', e.target.files)}
                        style={{ display: 'none' }}
                        id="settings-product-images"
                      />
                      <label htmlFor="settings-product-images" style={uploadLabelStyle}>
                        <Upload size={16} />
                        Choose Product Images
                      </label>
                      <div style={settingsImageGridStyle}>
                        {formData.product_images.map((file, index) => (
                          <div key={index} style={previewWrapStyle}>
                            <img src={URL.createObjectURL(file)} alt={`Product ${index + 1}`} style={previewImageStyle} />
                            <button onClick={() => removeFile('product_images', index)} style={removeBtnStyle}>
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Competitors */}
              <div style={sectionStyle}>
                <CompetitorSection
                  competitors={formData.competitors}
                  socialPlatforms={SOCIAL_PLATFORMS}
                  onAddCompetitor={addCompetitor}
                  onUpdateCompetitor={updateCompetitor}
                  onRemoveCompetitor={removeCompetitor}
                  onAddLink={addCompetitorLink}
                  onUpdateLink={updateCompetitorLink}
                  onRemoveLink={removeCompetitorLink}
                  maxCompetitors={3}
                  title="Competitors"
                  subtitle="Keep your competitive set tidy and current so reports, ideas, and onboarding stay grounded in the right market context."
                />
              </div>

              {/* Save Button */}
              <div style={saveBarStyle}>
                <div style={saveBarCopyStyle}>
                  <Sparkles size={16} />
                  Changes here keep your settings aligned with onboarding.
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    ...buttonStyle,
                    background: 'linear-gradient(135deg, #00d7ff 0%, #38bdf8 100%)',
                    color: '#021418',
                    fontWeight: 700,
                    padding: '12px 24px'
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} style={{ marginRight: 8 }} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const pageStyle = {
  padding: '28px 32px 40px',
  maxWidth: 1240,
  margin: '0 auto',
};

const heroStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.7fr) minmax(240px, .8fr)',
  gap: 18,
  marginBottom: 24,
  padding: '22px 24px',
  borderRadius: 26,
  background: 'linear-gradient(135deg, #ecfeff 0%, #ffffff 50%, #eef2ff 100%)',
  border: '1px solid #c7f3ff',
  boxShadow: '0 18px 44px rgba(15,23,42,.05)',
};

const heroBadgeStyle = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#ffffff',
  color: '#0f766e',
  fontSize: 12,
  fontWeight: 800,
};

const heroTitleStyle = {
  margin: '14px 0 8px',
  fontSize: 30,
  lineHeight: 1.1,
  fontWeight: 900,
  color: '#0f172a',
};

const heroTextStyle = {
  margin: 0,
  color: '#64748b',
  fontSize: 14,
  lineHeight: 1.7,
  maxWidth: 700,
};

const heroPanelStyle = {
  padding: 18,
  borderRadius: 22,
  background: 'rgba(255,255,255,.82)',
  border: '1px solid #dbeafe',
  display: 'grid',
  gap: 8,
  alignContent: 'start',
};

const heroPanelLabelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '.08em',
};

const heroPanelValueStyle = {
  fontSize: 30,
  fontWeight: 900,
  color: '#0f172a',
};

const heroPanelTextStyle = {
  fontSize: 13,
  color: '#475569',
  fontWeight: 600,
};

const tabBarStyle = {
  display: 'inline-flex',
  gap: 8,
  padding: 6,
  borderRadius: 18,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
};

const tabStyle = {
  padding: '12px 18px',
  background: 'transparent',
  border: 'none',
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  color: '#64748b',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const activeTabStyle = {
  background: '#ffffff',
  color: '#0f172a',
  boxShadow: '0 8px 20px rgba(15,23,42,.06)',
};

const loadingStateStyle = {
  textAlign: 'center',
  padding: 48,
  background: '#ffffff',
  borderRadius: 22,
  border: '1px solid #e2e8f0',
};

const sectionStyle = {
  background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 24,
  boxShadow: '0 12px 30px rgba(15,23,42,.04)',
};

const sectionHeaderStyle = {
  display: 'flex',
  gap: 14,
  alignItems: 'flex-start',
  marginBottom: 18,
};

const sectionIconStyle = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: 'linear-gradient(135deg, #00d7ff 0%, #0ea5e9 100%)',
  color: '#042f3a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxShadow: '0 10px 24px rgba(14,165,233,.18)',
};

const sectionTitleStyle = {
  fontSize: 20,
  fontWeight: 800,
  color: '#111827',
  marginBottom: 6,
  marginTop: 0,
};

const sectionCopyStyle = {
  margin: 0,
  fontSize: 13,
  color: '#64748b',
  lineHeight: 1.6,
};

const gridTwoStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 16,
};

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column',
};

const labelStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: '#334155',
  marginBottom: 8,
};

const inputStyle = {
  padding: '12px 14px',
  border: '1.5px solid #dbe4ee',
  borderRadius: 16,
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  background: 'white',
  boxSizing: 'border-box',
};

const textareaStyle = {
  ...inputStyle,
  minHeight: 96,
  resize: 'vertical',
  fontFamily: 'inherit',
};

const pillGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  gap: 12,
};

const checkboxPillStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 14px',
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#fff',
  fontSize: 14,
  cursor: 'pointer',
  color: '#334155',
  fontWeight: 600,
};

const checkboxPillActiveStyle = {
  border: '1px solid #7dd3fc',
  background: '#ecfeff',
};

const checkboxStyle = {
  margin: 0,
  accentColor: CYAN,
};

const assetGridStyle = {
  display: 'grid',
  gap: 18,
};

const assetCardStyle = {
  display: 'grid',
  gap: 14,
  padding: 22,
  borderRadius: 22,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
};

const assetCardAltStyle = {
  display: 'grid',
  gap: 14,
  padding: 22,
  borderRadius: 22,
  background: 'linear-gradient(180deg, #f8fafc 0%, #fbfdff 100%)',
  border: '1px solid #e2e8f0',
};

const assetTitleStyle = {
  fontSize: 18,
  fontWeight: 800,
  color: '#0f172a',
};

const assetTextStyle = {
  fontSize: 13,
  color: '#64748b',
  lineHeight: 1.6,
};

const uploadStackStyle = {
  display: 'grid',
  gap: 12,
};

const uploadLabelStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '14px 16px',
  borderRadius: 16,
  border: '2px dashed #bae6fd',
  background: 'linear-gradient(180deg, #f8fdff 0%, #effbff 100%)',
  color: '#0369a1',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
};

const settingsImageGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: 12,
};

const previewWrapStyle = {
  position: 'relative',
  display: 'inline-block',
};

const previewImageStyle = {
  width: 120,
  height: 120,
  objectFit: 'cover',
  borderRadius: 14,
  border: '1px solid #e2e8f0',
};

const removeBtnStyle = {
  position: 'absolute',
  top: -6,
  right: -6,
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: '#ef4444',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const saveBarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  paddingTop: 24,
  borderTop: '1px solid #e5e7eb',
  flexWrap: 'wrap',
};

const saveBarCopyStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  color: '#64748b',
  fontSize: 13,
  fontWeight: 600,
};

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 16px',
  border: 'none',
  borderRadius: 14,
  fontSize: 14,
  cursor: 'pointer',
  transition: 'all 0.2s',
  gap: 8,
  boxShadow: '0 12px 24px rgba(0,215,255,.18)',
};
