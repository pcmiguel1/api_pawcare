window.onload = function () {

    const client = new window.HelloSign({
        clientId: '156d9bd2d04f4a46604a365cea400442'
      });
      
      /*// Get the current URL's query parameters
      const urlParams = new URLSearchParams(window.location.search);

      // Get the specific query parameters you need
      const signUrl = urlParams.get("sign_url");*/

      // Get the current URL
  var currentURL = window.location.href;

  // Create a URL object from the current URL
  var url = new URL(currentURL);

  // Get the value of the 'sign_url' parameter
  var signUrlParam = url.searchParams.get("sign_url");

  // Append any additional query parameters you need
  signUrlParam += "&token=" + url.searchParams.get("token");

      client.open(`${signUrlParam}`, {
        clientId: '156d9bd2d04f4a46604a365cea400442',
        skipDomainVerification: true,
        testMode: true
      });

      client.on('sign', (data) => {
        Android.onSubmit();
      });

      client.on('cancel', (data) => {
        Android.onCancel();
      });

      client.on('close', (data) => {
        Android.onCancel();
      });
    
}