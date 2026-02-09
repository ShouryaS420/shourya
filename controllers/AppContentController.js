// controllers/AppContentController.js

function pickLang(req) {
    const lang = String(req.headers["x-app-lang"] || "en")
        .toLowerCase()
        .split("-")[0];
    return ["en", "hi", "mr"].includes(lang) ? lang : "en";
}

const CONTENT = {
    privacy: {
        en: {
            title: "Privacy Policy",
            updatedAt: "29 January 2026",
            sections: [
                {
                    h: "1. Introduction",
                    p:
                        "TowardsNorth Global Project Private Limited (“TowardsNorth”, “Company”, “we”, “our”, “us”) is committed to protecting the privacy and personal data of workers, vendors, and partners (“you”, “user”) who access or use the TowardsNorth Workforce mobile application and related services.\n\n" +
                        "This Privacy Policy explains how we collect, use, store, protect, and disclose your information."
                },
                {
                    h: "2. Scope of This Policy",
                    p:
                        "This Privacy Policy applies to:\n" +
                        "• The TowardsNorth Workforce mobile application\n" +
                        "• Workforce-related services including attendance, payroll, incentives, and communication\n\n" +
                        "By using the app, you agree to this Privacy Policy."
                },
                {
                    h: "3. Information We Collect",
                    p:
                        "3.1 Personal Information\n" +
                        "• Full name\n• Mobile number\n• Worker / Vendor ID\n• Profile photograph (if provided)\n• Preferred language\n\n" +
                        "3.2 Work & Attendance Information\n" +
                        "• Check-in and check-out times\n• Worksite / project assignment\n• Role, trade, and skill category\n• Performance and productivity metrics\n\n" +
                        "3.3 Financial & Bank Information (for payout purposes)\n" +
                        "• Account holder name\n• Bank account number\n• IFSC code\n• Bank & branch name\n• UPI ID (optional)\n\n" +
                        "We never collect ATM PINs, card numbers, or banking passwords.\n\n" +
                        "3.4 Device & Technical Information\n" +
                        "• Device type and OS version\n• App usage logs\n• Language preference"
                },
                {
                    h: "4. Purpose of Data Collection",
                    p:
                        "We use your information to:\n" +
                        "1) Track attendance and work participation\n" +
                        "2) Calculate wages, incentives, and bonuses\n" +
                        "3) Process salary and payout transactions\n" +
                        "4) Assign worker tiers, levels, and eligibility\n" +
                        "5) Send operational notifications and alerts\n" +
                        "6) Improve system reliability and user experience\n" +
                        "7) Meet legal, audit, and compliance requirements"
                },
                {
                    h: "5. Bank Details & Payments",
                    p:
                        "Bank details are required only for salary payments.\n\n" +
                        "• Once verified, bank details cannot be edited directly by the user.\n" +
                        "• Any correction requires admin or support verification.\n" +
                        "• All payouts are processed through authorized banking channels."
                },
                {
                    h: "6. Data Sharing & Disclosure",
                    p:
                        "We do not sell, rent, or trade your personal data.\n\n" +
                        "Data may be shared only:\n" +
                        "• With payment processors for salary disbursement\n" +
                        "• With internal teams for operational purposes\n" +
                        "• With legal or government authorities if required by law"
                },
                {
                    h: "7. Data Storage & Security",
                    p:
                        "We use industry-standard security measures:\n" +
                        "• Secure servers and databases\n" +
                        "• Encrypted communication\n" +
                        "• Role-based internal access\n" +
                        "• OTP-based authentication\n\n" +
                        "Despite safeguards, users are advised to keep login credentials confidential."
                },
                {
                    h: "8. User Rights",
                    p:
                        "You have the right to:\n" +
                        "• View your personal data\n" +
                        "• Request correction of incorrect information\n" +
                        "• Understand how your data is used\n" +
                        "• Contact support for data-related concerns\n\n" +
                        "Some data (name, worker ID, verified bank details) is locked for security reasons."
                },
                {
                    h: "9. Data Retention",
                    p:
                        "Your data is retained:\n" +
                        "• While your account is active\n" +
                        "• As required for payroll, compliance, and legal purposes\n\n" +
                        "Data may be retained after deactivation as per applicable laws."
                },
                {
                    h: "10. Children’s Privacy",
                    p:
                        "This app is not intended for individuals below 18 years. We do not knowingly collect data from minors."
                },
                {
                    h: "11. Changes to This Policy",
                    p:
                        "This Privacy Policy may be updated periodically. Updates will be reflected in the app. Continued use implies acceptance of changes."
                },
                {
                    h: "12. Contact Information",
                    p:
                        "For privacy-related concerns:\n\n" +
                        "TowardsNorth Global Project Private Limited\n" +
                        "Pune, Maharashtra, India\n" +
                        "Email: support@towardsnorth.com"
                }
            ]
        },

        hi: {
            title: "गोपनीयता नीति",
            updatedAt: "29 जनवरी 2026",
            sections: [
                {
                    h: "1. परिचय",
                    p:
                        "TowardsNorth Global Project Private Limited (“TowardsNorth”, “कंपनी”, “हम”, “हमारा”) सभी वर्कर, वेंडर और पार्टनर्स (“आप”, “यूज़र”) की जानकारी की गोपनीयता और सुरक्षा के लिए प्रतिबद्ध है।\n\n" +
                        "यह गोपनीयता नीति बताती है कि हम आपकी जानकारी कैसे एकत्र, उपयोग, संग्रह और साझा करते हैं।"
                },
                {
                    h: "2. इस नीति का दायरा",
                    p:
                        "यह नीति लागू होती है:\n" +
                        "• TowardsNorth Workforce मोबाइल ऐप पर\n" +
                        "• उपस्थिति, पे-रोल, इंसेंटिव और कम्युनिकेशन जैसी सभी सेवाओं पर\n\n" +
                        "ऐप का उपयोग करने पर आप इस नीति से सहमत होते हैं।"
                },
                {
                    h: "3. हम कौन-सी जानकारी एकत्र करते हैं",
                    p:
                        "3.1 व्यक्तिगत जानकारी\n" +
                        "• पूरा नाम\n• मोबाइल नंबर\n• वर्कर / वेंडर ID\n• प्रोफ़ाइल फोटो (यदि दिया गया हो)\n• पसंदीदा भाषा\n\n" +
                        "3.2 कार्य व उपस्थिति जानकारी\n" +
                        "• चेक-इन / चेक-आउट समय\n• कार्य स्थल / प्रोजेक्ट असाइनमेंट\n• भूमिका, ट्रेड और स्किल कैटेगरी\n• परफॉर्मेंस और प्रोडक्टिविटी मेट्रिक्स\n\n" +
                        "3.3 वित्तीय व बैंक जानकारी (केवल पेआउट हेतु)\n" +
                        "• खाता धारक का नाम\n• बैंक खाता संख्या\n• IFSC\n• बैंक व शाखा का नाम\n• UPI ID (वैकल्पिक)\n\n" +
                        "हम कभी भी ATM PIN, कार्ड नंबर या बैंकिंग पासवर्ड नहीं लेते।\n\n" +
                        "3.4 डिवाइस व तकनीकी जानकारी\n" +
                        "• डिवाइस प्रकार और OS वर्ज़न\n• ऐप उपयोग लॉग\n• भाषा पसंद"
                },
                {
                    h: "4. जानकारी एकत्र करने का उद्देश्य",
                    p:
                        "हम आपकी जानकारी का उपयोग:\n" +
                        "1) उपस्थिति और कार्य भागीदारी ट्रैक करने\n" +
                        "2) वेतन, इंसेंटिव और बोनस की गणना\n" +
                        "3) सैलरी/पेआउट प्रोसेसिंग\n" +
                        "4) टियर, लेवल और पात्रता तय करने\n" +
                        "5) महत्वपूर्ण नोटिफिकेशन भेजने\n" +
                        "6) सिस्टम सुधार और विश्वसनीयता बढ़ाने\n" +
                        "7) कानूनी/ऑडिट/कंप्लायंस आवश्यकताओं हेतु"
                },
                {
                    h: "5. बैंक विवरण और भुगतान",
                    p:
                        "बैंक विवरण केवल सैलरी/पेआउट के लिए आवश्यक है।\n\n" +
                        "• सत्यापित होने के बाद बैंक विवरण यूज़र द्वारा सीधे बदले नहीं जा सकते।\n" +
                        "• बदलाव के लिए एडमिन/सपोर्ट सत्यापन आवश्यक होगा।\n" +
                        "• सभी पेआउट अधिकृत बैंकिंग चैनल के जरिए होते हैं।"
                },
                {
                    h: "6. जानकारी साझा करना",
                    p:
                        "हम आपकी जानकारी को बेचते, किराए पर नहीं देते और न ही ट्रेड करते हैं।\n\n" +
                        "जानकारी केवल इन परिस्थितियों में साझा हो सकती है:\n" +
                        "• पेमेंट प्रोसेसर के साथ पेआउट के लिए\n" +
                        "• ऑपरेशनल कार्य के लिए आंतरिक टीम के साथ\n" +
                        "• कानून के अनुसार सरकारी/कानूनी एजेंसियों के साथ"
                },
                {
                    h: "7. डेटा सुरक्षा",
                    p:
                        "हम इंडस्ट्री-स्टैंडर्ड सुरक्षा उपाय अपनाते हैं:\n" +
                        "• सुरक्षित सर्वर/डेटाबेस\n• एन्क्रिप्टेड कम्युनिकेशन\n• रोल-बेस्ड एक्सेस\n• OTP आधारित लॉगिन\n\n" +
                        "फिर भी, कृपया OTP/लॉगिन जानकारी किसी के साथ साझा न करें।"
                },
                {
                    h: "8. आपके अधिकार",
                    p:
                        "आपका अधिकार है:\n" +
                        "• अपनी जानकारी देखना\n• गलत जानकारी सुधारने का अनुरोध करना\n• जानकारी उपयोग का उद्देश्य समझना\n• सपोर्ट से संपर्क करना\n\n" +
                        "कुछ जानकारी (नाम, वर्कर ID, सत्यापित बैंक विवरण) सुरक्षा कारणों से लॉक रहती है।"
                },
                {
                    h: "9. डेटा संग्रहण अवधि",
                    p:
                        "डेटा रखा जाता है:\n" +
                        "• जब तक आपका अकाउंट सक्रिय है\n" +
                        "• पे-रोल/कंप्लायंस/कानूनी जरूरतों के अनुसार\n\n" +
                        "अकाउंट बंद होने के बाद भी कानून के अनुसार डेटा रखा जा सकता है।"
                },
                { h: "10. बच्चों की गोपनीयता", p: "यह ऐप 18 वर्ष से कम उम्र के लिए नहीं है। हम जानबूझकर नाबालिगों का डेटा एकत्र नहीं करते।" },
                { h: "11. नीति में बदलाव", p: "यह नीति समय-समय पर अपडेट हो सकती है। अपडेट ऐप में दिखाए जाएंगे। ऐप का उपयोग जारी रखने का मतलब अपडेट स्वीकार करना है।" },
                {
                    h: "12. संपर्क",
                    p:
                        "गोपनीयता संबंधित प्रश्नों हेतु:\n\n" +
                        "TowardsNorth Global Project Private Limited\n" +
                        "पुणे, महाराष्ट्र, भारत\n" +
                        "ईमेल: support@towardsnorth.com"
                }
            ]
        },

        mr: {
            title: "गोपनीयता धोरण",
            updatedAt: "29 जानेवारी 2026",
            sections: [
                {
                    h: "1. परिचय",
                    p:
                        "TowardsNorth Global Project Private Limited (“TowardsNorth”, “कंपनी”, “आम्ही”, “आमचे”) वर्कर, व्हेंडर आणि पार्टनर्स (“तुम्ही”, “युजर”) यांचा डेटा सुरक्षित ठेवण्यासाठी कटिबद्ध आहे.\n\n" +
                        "हे धोरण आम्ही माहिती कशी गोळा करतो, वापरतो, जतन करतो आणि आवश्यक असल्यास शेअर करतो हे स्पष्ट करते."
                },
                {
                    h: "2. धोरणाचा व्याप्ती",
                    p:
                        "हे धोरण लागू होते:\n" +
                        "• TowardsNorth Workforce मोबाईल अ‍ॅपवर\n" +
                        "• उपस्थिती, पेरोल, इन्सेंटिव्ह आणि कम्युनिकेशन सेवांवर\n\n" +
                        "अ‍ॅप वापरल्यास तुम्ही या धोरणाला संमती देता."
                },
                {
                    h: "3. आम्ही कोणती माहिती गोळा करतो",
                    p:
                        "3.1 वैयक्तिक माहिती\n" +
                        "• पूर्ण नाव\n• मोबाईल नंबर\n• वर्कर / व्हेंडर ID\n• प्रोफाईल फोटो (दिल्यास)\n• पसंतीची भाषा\n\n" +
                        "3.2 काम व उपस्थिती माहिती\n" +
                        "• चेक-इन / चेक-आउट वेळ\n• साइट / प्रोजेक्ट असाइनमेंट\n• भूमिका, ट्रेड व स्किल कॅटेगरी\n• परफॉर्मन्स व प्रोडक्टिव्हिटी मेट्रिक्स\n\n" +
                        "3.3 आर्थिक व बँक माहिती (फक्त पेआउटसाठी)\n" +
                        "• खातेधारकाचे नाव\n• बँक खाते क्रमांक\n• IFSC\n• बँक व शाखा नाव\n• UPI ID (ऐच्छिक)\n\n" +
                        "आम्ही कधीही ATM PIN, कार्ड नंबर किंवा बँकिंग पासवर्ड घेत नाही.\n\n" +
                        "3.4 डिव्हाइस व तांत्रिक माहिती\n" +
                        "• डिव्हाइस प्रकार आणि OS व्हर्जन\n• अ‍ॅप वापर लॉग\n• भाषा पसंती"
                },
                {
                    h: "4. माहितीचा वापर कशासाठी होतो",
                    p:
                        "आम्ही तुमची माहिती वापरतो:\n" +
                        "1) उपस्थिती व कामाची भागीदारी ट्रॅक करण्यासाठी\n" +
                        "2) वेतन, इन्सेंटिव्ह आणि बोनस गणनेसाठी\n" +
                        "3) सॅलरी/पेआउट प्रोसेसिंगसाठी\n" +
                        "4) टिअर, लेव्हल व पात्रता ठरवण्यासाठी\n" +
                        "5) महत्वाच्या सूचना/नोटिफिकेशन पाठवण्यासाठी\n" +
                        "6) सिस्टम सुधारणा आणि विश्वासार्हता वाढवण्यासाठी\n" +
                        "7) कायदेशीर/ऑडिट/कंप्लायंस गरजांसाठी"
                },
                {
                    h: "5. बँक तपशील आणि पेमेंट",
                    p:
                        "बँक तपशील फक्त सॅलरी/पेआउटसाठी आवश्यक आहेत.\n\n" +
                        "• व्हेरिफाई झाल्यावर बँक तपशील युजरकडून थेट बदलता येत नाहीत.\n" +
                        "• बदलासाठी अ‍ॅडमिन/सपोर्ट व्हेरिफिकेशन आवश्यक आहे.\n" +
                        "• सर्व पेआउट अधिकृत बँकिंग चॅनेलद्वारे केले जातात."
                },
                {
                    h: "6. माहिती शेअर करणे",
                    p:
                        "आम्ही तुमचा डेटा विकत नाही, भाड्याने देत नाही किंवा ट्रेड करत नाही.\n\n" +
                        "माहिती फक्त खालील प्रसंगी शेअर होऊ शकते:\n" +
                        "• पेआउटसाठी पेमेंट प्रोसेसरसोबत\n" +
                        "• ऑपरेशनल कामासाठी अंतर्गत टीमसोबत\n" +
                        "• कायद्याने आवश्यक असल्यास सरकारी/कायदेशीर संस्थांशी"
                },
                {
                    h: "7. डेटा सुरक्षा",
                    p:
                        "आम्ही इंडस्ट्री-स्टँडर्ड सुरक्षा उपाय वापरतो:\n" +
                        "• सुरक्षित सर्व्हर/डेटाबेस\n• एन्क्रिप्टेड कम्युनिकेशन\n• रोल-बेस्ड अ‍ॅक्सेस\n• OTP आधारित लॉगिन\n\n" +
                        "तरीही, OTP/लॉगिन माहिती कोणासोबतही शेअर करू नका."
                },
                {
                    h: "8. तुमचे हक्क",
                    p:
                        "तुम्हाला अधिकार आहेत:\n" +
                        "• तुमची माहिती पाहणे\n• चुकीची माहिती दुरुस्त करण्याची विनंती\n• माहितीचा वापर समजून घेणे\n• सपोर्टशी संपर्क\n\n" +
                        "काही माहिती (नाव, वर्कर ID, व्हेरिफाई बँक तपशील) सुरक्षा कारणांमुळे लॉक असते."
                },
                {
                    h: "9. डेटा जतन कालावधी",
                    p:
                        "डेटा जतन केला जातो:\n" +
                        "• तुमचे खाते सक्रिय असेपर्यंत\n" +
                        "• पेरोल/कंप्लायंस/कायदेशीर गरजांनुसार\n\n" +
                        "खाते बंद झाल्यानंतरही कायद्याप्रमाणे डेटा ठेवला जाऊ शकतो."
                },
                { h: "10. बालकांची गोपनीयता", p: "हा अ‍ॅप 18 वर्षांखालील व्यक्तींसाठी नाही. आम्ही जाणूनबुजून अल्पवयीनांचा डेटा गोळा करत नाही." },
                { h: "11. धोरण बदल", p: "हे धोरण वेळोवेळी अपडेट होऊ शकते. अपडेट अ‍ॅपमध्ये दिसतील. अ‍ॅप वापरणे सुरू ठेवणे म्हणजे अपडेट स्वीकारणे." },
                {
                    h: "12. संपर्क",
                    p:
                        "गोपनीयतेसंबंधित प्रश्नांसाठी:\n\n" +
                        "TowardsNorth Global Project Private Limited\n" +
                        "पुणे, महाराष्ट्र, भारत\n" +
                        "ईमेल: support@towardsnorth.com"
                }
            ]
        }
    },

    about: {
        en: {
            title: "About App",
            updatedAt: "2026-01-01",
            sections: [
                { h: "Purpose", p: "This app helps workers track attendance, earnings, payouts, and offers." },
                { h: "Worker tiers", p: "Your level improves with consistency and performance. Keep attendance strong to grow faster." }
            ]
        },
        hi: {
            title: "ऐप के बारे में",
            updatedAt: "2026-01-01",
            sections: [
                { h: "उद्देश्य", p: "यह ऐप उपस्थिति, कमाई, भुगतान और ऑफ़र्स ट्रैक करने में मदद करता है।" },
                { h: "वर्कर टियर", p: "नियमितता और प्रदर्शन से आपका लेवल बढ़ता है। बेहतर उपस्थिति रखें।" }
            ]
        },
        mr: {
            title: "अ‍ॅप बद्दल",
            updatedAt: "2026-01-01",
            sections: [
                { h: "उद्दिष्ट", p: "हा अ‍ॅप उपस्थिती, कमाई, पेआउट आणि ऑफर्स ट्रॅक करण्यासाठी मदत करतो." },
                { h: "वर्कर टिअर", p: "नियमितता व कामगिरीनुसार लेव्हल वाढतो. उपस्थिती मजबूत ठेवा." }
            ]
        }
    },

    faq: {
        en: {
            title: "Help & Support",
            updatedAt: "29 January 2026",
            categories: [
                {
                    c: "Getting Started",
                    items: [
                        {
                            q: "What is the TowardsNorth Workforce App?",
                            a: "The TowardsNorth Workforce App helps workers track attendance, earnings, payouts, offers, and performance-related benefits in a transparent way."
                        },
                        {
                            q: "Who can use this app?",
                            a: "This app is designed for workers, site staff, and vendors officially associated with TowardsNorth projects."
                        }
                    ]
                },
                {
                    c: "Attendance",
                    items: [
                        {
                            q: "How do I mark attendance?",
                            a: "You can mark attendance using the Check-In and Check-Out buttons available on your Home screen during working hours."
                        },
                        {
                            q: "What if I forget to check out?",
                            a: "If you forget to check out, your attendance may be auto-processed or flagged. Please contact your site supervisor if required."
                        }
                    ]
                },
                {
                    c: "Earnings & Payouts",
                    items: [
                        {
                            q: "When will I receive my payment?",
                            a: "Payments are processed weekly based on approved attendance and work completion."
                        },
                        {
                            q: "Where can I see my earnings?",
                            a: "You can view daily, weekly, and monthly earnings inside the Pocket or Earnings section of the app."
                        }
                    ]
                },
                {
                    c: "Bank Details",
                    items: [
                        {
                            q: "Why do I need to add bank details?",
                            a: "Bank details are required to process your salary or payout securely."
                        },
                        {
                            q: "Can I change my bank details?",
                            a: "Once bank details are verified, they cannot be edited directly. Please contact support if a correction is required."
                        }
                    ]
                },
                {
                    c: "Language & App Settings",
                    items: [
                        {
                            q: "How do I change app language?",
                            a: "You can change the app language from the Menu → Language settings."
                        }
                    ]
                },
                {
                    c: "Account & Security",
                    items: [
                        {
                            q: "Is my data safe?",
                            a: "Yes. We use secure servers, encrypted communication, and restricted access to protect your data."
                        },
                        {
                            q: "Can I edit my name or profile photo?",
                            a: "Some profile details are locked for security and compliance reasons."
                        }
                    ]
                }
            ]
        },

        hi: {
            title: "सहायता और समर्थन",
            updatedAt: "29 जनवरी 2026",
            categories: [
                {
                    c: "शुरुआत",
                    items: [
                        {
                            q: "TowardsNorth Workforce ऐप क्या है?",
                            a: "यह ऐप वर्कर्स को उपस्थिति, कमाई, भुगतान और ऑफ़र्स ट्रैक करने में मदद करता है।"
                        },
                        {
                            q: "इस ऐप का उपयोग कौन कर सकता है?",
                            a: "यह ऐप TowardsNorth से जुड़े वर्कर्स और स्टाफ के लिए है।"
                        }
                    ]
                },
                {
                    c: "उपस्थिति",
                    items: [
                        {
                            q: "मैं उपस्थिति कैसे दर्ज करूं?",
                            a: "आप होम स्क्रीन पर Check-In और Check-Out बटन से उपस्थिति दर्ज कर सकते हैं।"
                        },
                        {
                            q: "अगर Check-Out करना भूल जाऊं तो?",
                            a: "ऐसी स्थिति में उपस्थिति ऑटो प्रोसेस हो सकती है या सुपरवाइज़र से संपर्क करना पड़ सकता है।"
                        }
                    ]
                },
                {
                    c: "कमाई और भुगतान",
                    items: [
                        {
                            q: "मुझे भुगतान कब मिलेगा?",
                            a: "उपस्थिति और काम के आधार पर भुगतान साप्ताहिक किया जाता है।"
                        },
                        {
                            q: "मैं अपनी कमाई कहां देख सकता हूं?",
                            a: "आप Pocket या Earnings सेक्शन में अपनी कमाई देख सकते हैं।"
                        }
                    ]
                },
                {
                    c: "बैंक विवरण",
                    items: [
                        {
                            q: "बैंक विवरण क्यों ज़रूरी है?",
                            a: "सुरक्षित भुगतान के लिए बैंक विवरण आवश्यक है।"
                        },
                        {
                            q: "क्या मैं बैंक विवरण बदल सकता हूं?",
                            a: "सत्यापन के बाद बैंक विवरण बदला नहीं जा सकता। सपोर्ट से संपर्क करें।"
                        }
                    ]
                }
            ]
        },

        mr: {
            title: "मदत आणि समर्थन",
            updatedAt: "29 जानेवारी 2026",
            categories: [
                {
                    c: "सुरुवात",
                    items: [
                        {
                            q: "TowardsNorth Workforce अ‍ॅप म्हणजे काय?",
                            a: "हा अ‍ॅप उपस्थिती, कमाई, पेआउट आणि ऑफर्स ट्रॅक करण्यासाठी मदत करतो."
                        }
                    ]
                },
                {
                    c: "उपस्थिती",
                    items: [
                        {
                            q: "उपस्थिती कशी नोंदवायची?",
                            a: "होम स्क्रीनवरील Check-In आणि Check-Out बटण वापरा."
                        }
                    ]
                },
                {
                    c: "पेमेंट",
                    items: [
                        {
                            q: "पेमेंट कधी मिळते?",
                            a: "उपस्थिती आणि कामाच्या आधारे आठवड्याला पेमेंट दिले जाते."
                        }
                    ]
                }
            ]
        }
    }
};

export const getPrivacyPolicy = async (req, res) => {
    const lang = pickLang(req);
    return res.json({ success: true, ...CONTENT.privacy[lang] });
};

export const getAboutApp = async (req, res) => {
    const lang = pickLang(req);
    return res.json({ success: true, ...CONTENT.about[lang] });
};

export const getFaqs = async (req, res) => {
    const lang = pickLang(req);
    return res.json({
        success: true,
        ...(CONTENT.faq[lang] || CONTENT.faq.en),
    });
};
